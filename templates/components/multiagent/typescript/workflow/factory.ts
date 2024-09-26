import {
  Context,
  StartEvent,
  StopEvent,
  Workflow,
  WorkflowEvent,
} from "@llamaindex/core/workflow";
import { ChatMessage, ChatResponseChunk } from "llamaindex";
import { createResearcher, createReviewer, createWriter } from "./agents";
import { AgentInput, AgentRunEvent } from "./type";

const TIMEOUT = 360 * 1000;
const MAX_ATTEMPTS = 2;

class ResearchEvent extends WorkflowEvent<{ input: string }> {}
class WriteEvent extends WorkflowEvent<{
  input: string;
  isGood: boolean;
}> {}
class ReviewEvent extends WorkflowEvent<{ input: string }> {}

export const createWorkflow = (chatHistory: ChatMessage[]) => {
  const runAgent = async (
    context: Context,
    agent: Workflow,
    input: AgentInput,
  ) => {
    const run = agent.run(new StartEvent({ input }));
    for await (const event of agent.streamEvents()) {
      if (event.data instanceof AgentRunEvent) {
        context.writeEventToStream(event.data);
      }
    }
    return await run;
  };

  const start = async (context: Context, ev: StartEvent) => {
    context.set("task", ev.data.input);
    return new ResearchEvent({
      input: `Research for this task: ${ev.data.input}`,
    });
  };

  const research = async (context: Context, ev: ResearchEvent) => {
    const researcher = await createResearcher(chatHistory);
    const researchRes = await runAgent(context, researcher, {
      message: ev.data.input,
    });
    const researchResult = researchRes.data.result;
    return new WriteEvent({
      input: `Write a blog post given this task: ${context.get("task")} using this research content: ${researchResult}`,
      isGood: false,
    });
  };

  const write = async (context: Context, ev: WriteEvent) => {
    context.set("attempts", context.get("attempts", 0) + 1);
    const tooManyAttempts = context.get("attempts") > MAX_ATTEMPTS;
    if (tooManyAttempts) {
      context.writeEventToStream(
        new AgentRunEvent({
          name: "writer",
          msg: `Too many attempts (${MAX_ATTEMPTS}) to write the blog post. Proceeding with the current version.`,
        }),
      );
    }

    if (ev.data.isGood || tooManyAttempts) {
      // The text is ready for publication, we just use the writer to stream the output
      const writer = createWriter(chatHistory);
      const content = context.get("result");

      return (await runAgent(context, writer, {
        message: `You're blog post is ready for publication. Please respond with just the blog post. Blog post: \`\`\`${content}\`\`\``,
        streaming: true,
      })) as unknown as StopEvent<AsyncGenerator<ChatResponseChunk>>;
    }

    const writer = createWriter(chatHistory);
    const writeRes = await runAgent(context, writer, {
      message: ev.data.input,
    });
    const writeResult = writeRes.data.result;
    context.set("result", writeResult); // store the last result
    return new ReviewEvent({ input: writeResult });
  };

  const review = async (context: Context, ev: ReviewEvent) => {
    const reviewer = createReviewer(chatHistory);
    const reviewRes = await reviewer.run(
      new StartEvent<AgentInput>({ input: { message: ev.data.input } }),
    );
    const reviewResult = reviewRes.data.result;
    const oldContent = context.get("result");
    const postIsGood = reviewResult.toLowerCase().includes("post is good");
    context.writeEventToStream(
      new AgentRunEvent({
        name: "reviewer",
        msg: `The post is ${postIsGood ? "" : "not "}good enough for publishing. Sending back to the writer${
          postIsGood ? " for publication." : "."
        }`,
      }),
    );
    if (postIsGood) {
      return new WriteEvent({
        input: "",
        isGood: true,
      });
    }

    return new WriteEvent({
      input: `Improve the writing of a given blog post by using a given review.
            Blog post:
            \`\`\`
            ${oldContent}
            \`\`\`

            Review:
            \`\`\`
            ${reviewResult}
            \`\`\``,
      isGood: false,
    });
  };

  const workflow = new Workflow({ timeout: TIMEOUT, validate: true });
  workflow.addStep(StartEvent, start, { outputs: ResearchEvent });
  workflow.addStep(ResearchEvent, research, { outputs: WriteEvent });
  workflow.addStep(WriteEvent, write, { outputs: [ReviewEvent, StopEvent] });
  workflow.addStep(ReviewEvent, review, { outputs: WriteEvent });

  return workflow;
};

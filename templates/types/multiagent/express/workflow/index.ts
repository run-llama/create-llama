import {
  Context,
  StartEvent,
  StopEvent,
  Workflow,
  WorkflowEvent,
} from "@llamaindex/core/workflow";
import { StreamData } from "ai";
import { ChatMessage } from "llamaindex";
import { createResearcher, createReviewer, createWriter } from "./agents";
import { AgentInput, AgentRunResult } from "./type";

const TIMEOUT = 360 * 1000;
const MAX_ATTEMPTS = 1;

class ResearchEvent extends WorkflowEvent<{ input: string }> {}
class WriteEvent extends WorkflowEvent<{
  input: string;
  isGood: boolean;
}> {}
class ReviewEvent extends WorkflowEvent<{ input: string }> {}

export const createWorkflow = async (
  chatHistory: ChatMessage[],
  stream: StreamData,
) => {
  const appendStream = (agent: string, text: string) => {
    stream.appendMessageAnnotation({
      type: "agent",
      data: { agent, text },
    });
  };

  const start = async (context: Context, ev: StartEvent) => {
    context.set("task", ev.data.input);
    return new ResearchEvent({
      input: `Research for this task: ${ev.data.input}`,
    });
  };

  const research = async (context: Context, ev: ResearchEvent) => {
    const researcher = await createResearcher(chatHistory, stream);
    const researchRes = await researcher.run(
      new StartEvent<AgentInput>({ input: { message: ev.data.input } }),
    );
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
      appendStream(
        "writer",
        `Too many attempts (${MAX_ATTEMPTS}) to write the blog post. Proceeding with the current version.`,
      );
    }

    if (ev.data.isGood || tooManyAttempts) {
      const writer = createWriter(chatHistory, stream);
      writer.run(
        new StartEvent<AgentInput>({
          input: { message: ev.data.input, streaming: true },
        }),
      );
      const finalResultStream = writer.streamEvents();
      context.writeEventToStream({
        data: new AgentRunResult(finalResultStream),
      });
      return new StopEvent({ result: finalResultStream }); // stop the workflow
    }

    const writer = createWriter(chatHistory, stream);
    const writeRes = await writer.run(
      new StartEvent<AgentInput>({ input: { message: ev.data.input } }),
    );
    const writeResult = writeRes.data.result;
    context.set("result", writeResult); // store the last result
    return new ReviewEvent({ input: writeResult });
  };

  const review = async (context: Context, ev: ReviewEvent) => {
    const reviewer = createReviewer(chatHistory, stream);
    const reviewRes = await reviewer.run(
      new StartEvent<AgentInput>({ input: { message: ev.data.input } }),
    );
    const reviewResult = reviewRes.data.result;
    const oldContent = context.get("result");
    const postIsGood = reviewResult.toLowerCase().includes("post is good");
    appendStream(
      "reviewer",
      `The post is ${postIsGood ? "" : "not "}good enough for publishing. Sending back to the writer${
        postIsGood ? " for publication." : "."
      }`,
    );
    if (postIsGood) {
      return new WriteEvent({
        input: `You're blog post is ready for publication. Please respond with just the blog post. Blog post: \`\`\`${oldContent}\`\`\``,
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

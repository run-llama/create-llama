import {
  Context,
  StartEvent,
  StopEvent,
  Workflow,
  WorkflowEvent,
} from "@llamaindex/core/workflow";
import { StreamData } from "ai";
import { ChatMessage, OpenAIAgent } from "llamaindex";
import { createResearcher, createReviewer, createWriter } from "./agents";

const TIMEOUT = 360 * 1000;
const MAX_ATTEMPTS = 2;

class ResearchEvent extends WorkflowEvent<{ input: string }> {}
class WriteEvent extends WorkflowEvent<{
  input: string;
  isGood: boolean;
}> {}
class ReviewEvent extends WorkflowEvent<{ input: string }> {}

class AgentRunEvent extends WorkflowEvent<{
  name: string;
  msg: string;
}> {}

class AgentRunResult {
  constructor(public response: string) {}
}

const createWorkflow = async (
  chatHistory: ChatMessage[],
  stream: StreamData,
) => {
  const appendStream = (agent: string, text: string) => {
    stream.appendMessageAnnotation({
      type: "agent",
      data: { agent, text },
    });
  };

  const runAgent = async (
    name: string,
    agent: OpenAIAgent,
    input: string,
    streaming: boolean = false,
  ): Promise<string> => {
    appendStream(name, `Start to work on: ${input}`);

    if (streaming) {
    }

    const response = await agent.chat({ message: input, stream: false });
    const result = response.message.content.toString();
    appendStream(name, "Finished task");
    console.log(
      `\n=== ${name} result ===\n`,
      result,
      "\n====================\n",
    );
    return result;
  };

  const start = async (context: Context, ev: StartEvent) => {
    
    context.set("task", ev.data.input);
    return new ResearchEvent({
      input: `Research for this task: ${ev.data.input}`,
    });
  };

  const research = async (context: Context, ev: ResearchEvent) => {
    const researcher = await createResearcher(chatHistory);
    const researchResult = await runAgent(
      "researcher",
      researcher,
      ev.data.input,
    );
    return new WriteEvent({
      input: `Write a blog post given this task: ${context.get("task")} using this research content: ${researchResult}`,
      isGood: false,
    });
  };

  const write = async (context: Context, ev: WriteEvent) => {
    const writer = createWriter(chatHistory);
    context.set("attempts", context.get("attempts", 0) + 1);
    const tooManyAttempts = context.get("attempts") > MAX_ATTEMPTS;
    if (tooManyAttempts) {
      appendStream(
        "writer",
        `Too many attempts (${MAX_ATTEMPTS}) to write the blog post. Proceeding with the current version.`,
      );
    }

    const writeResult = await runAgent("writer", writer, ev.data.input);
    if (ev.data.isGood || tooManyAttempts) {
      return new StopEvent({ result: new AgentRunResult(writeResult) }); // stop the workflow
    }

    context.set("result", writeResult); // store the last result
    return new ReviewEvent({ input: writeResult });
  };

  const review = async (context: Context, ev: ReviewEvent) => {
    const reviewer = createReviewer(chatHistory);
    const reviewResult = await runAgent("reviewer", reviewer, ev.data.input);
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

export {
  AgentRunEvent,
  AgentRunResult,
  createWorkflow,
  ResearchEvent,
  ReviewEvent,
  WriteEvent,
};

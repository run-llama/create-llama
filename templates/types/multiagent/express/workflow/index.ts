import {
  Context,
  StartEvent,
  StopEvent,
  Workflow,
  WorkflowEvent,
} from "@llamaindex/core/workflow";
import { ChatMessage } from "llamaindex";
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

const createWorkflow = async (chatHistory: ChatMessage[]) => {
  const start = async (context: Context, ev: StartEvent) => {
    const userInput = ev.data.input;
    context.set("task", userInput);
    return new ResearchEvent({ input: `Research for this task: ${userInput}` });
  };

  const research = async (context: Context, ev: ResearchEvent) => {
    const researcher = await createResearcher(chatHistory);
    const researchResponse = await researcher.chat({
      message: ev.data.input,
    });
    const researchResult = researchResponse.message.content;
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
      context.writeEventToStream(
        new AgentRunEvent({
          name: "writer",
          msg: `Too many attempts (${MAX_ATTEMPTS}) to write the blog post. Proceeding with the current version.`,
        }),
      );
    }
    if (ev.data.isGood || tooManyAttempts) {
      const writeRes = await writer.chat({ message: ev.data.input });
      const writeResult = writeRes.message.content.toString();
      return new StopEvent({ result: writeResult });
    }
    const writeRes = await writer.chat({ message: ev.data.input });
    const writeResult = writeRes.message.content.toString();
    context.set("result", writeResult); // store the last result
    return new ReviewEvent({ input: writeResult });
  };

  const review = async (context: Context, ev: ReviewEvent) => {
    const reviewer = createReviewer(chatHistory);
    const reviewRes = await reviewer.chat({ message: ev.data.input });
    const reviewResult = reviewRes.message.content.toString();
    console.log({ reviewResult });
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
  createWorkflow,
  ResearchEvent,
  ReviewEvent,
  WriteEvent,
};

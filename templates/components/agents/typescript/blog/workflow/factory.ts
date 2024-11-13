import {
  HandlerContext,
  StartEvent,
  StopEvent,
  Workflow,
  WorkflowContext,
  WorkflowEvent,
} from "@llamaindex/workflow";
import { ChatMessage, ChatResponseChunk, Settings } from "llamaindex";
import {
  createPublisher,
  createResearcher,
  createReviewer,
  createWriter,
} from "./agents";
import {
  FunctionCallingAgent,
  FunctionCallingAgentInput,
} from "./single-agent";
import { AgentInput, AgentRunEvent } from "./type";

const TIMEOUT = 360 * 1000;
const MAX_ATTEMPTS = 2;

class ResearchEvent extends WorkflowEvent<{ input: string }> {}
class WriteEvent extends WorkflowEvent<{
  input: string;
  isGood: boolean;
}> {}
class ReviewEvent extends WorkflowEvent<{ input: string }> {}
class PublishEvent extends WorkflowEvent<{ input: string }> {}

type BlogContext = {
  task: string;
  attempts: number;
  result: string;
};

export const createWorkflow = ({
  chatHistory,
  params,
}: {
  chatHistory: ChatMessage[];
  params?: any;
}) => {
  const runAgent = async (
    context: HandlerContext<BlogContext>,
    agent: FunctionCallingAgent,
    input: FunctionCallingAgentInput,
  ) => {
    const agentContext = agent.run(input, {
      streaming: input.streaming ?? false,
    });
    for await (const event of agentContext) {
      if (event instanceof AgentRunEvent) {
        context.sendEvent(event);
      }
      if (event instanceof StopEvent) {
        return event;
      }
    }
    return null;
  };

  const start = async (
    context: HandlerContext<BlogContext>,
    ev: StartEvent<AgentInput>,
  ) => {
    const chatHistoryStr = chatHistory
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    // Decision-making process
    const decision = await decideWorkflow(
      ev.data.message.toString(),
      chatHistoryStr,
    );

    if (decision !== "publish") {
      return new ResearchEvent({
        input: `Research for this task: ${JSON.stringify(context.data.task)}`,
      });
    } else {
      return new PublishEvent({
        input: `Publish content based on the chat history\n${chatHistoryStr}\n\n and task: ${context.data.task}`,
      });
    }
  };

  const decideWorkflow = async (task: string, chatHistoryStr: string) => {
    const llm = Settings.llm;

    const prompt = `You are an expert in decision-making, helping people write and publish blog posts.
If the user is asking for a file or to publish content, respond with 'publish'.
If the user requests to write or update a blog post, respond with 'not_publish'.

Here is the chat history:
${chatHistoryStr}

The current user request is:
${task}

Given the chat history and the new user request, decide whether to publish based on existing information.
Decision (respond with either 'not_publish' or 'publish'):`;

    const output = await llm.complete({ prompt: prompt });
    const decision = output.text.trim().toLowerCase();
    return decision === "publish" ? "publish" : "research";
  };

  const research = async (
    context: HandlerContext<BlogContext>,
    ev: ResearchEvent,
  ) => {
    const researcher = await createResearcher(chatHistory);
    const researchRes = await runAgent(context, researcher, {
      displayName: "Researcher",
      message: ev.data.input,
    });
    const researchResult = researchRes?.data;

    return new WriteEvent({
      input: `Write a blog post given this task: ${JSON.stringify(
        context.data.task,
      )} using this research content: ${researchResult}`,
      isGood: false,
    });
  };

  const write = async (
    context: HandlerContext<BlogContext>,
    ev: WriteEvent,
  ) => {
    const writer = createWriter(chatHistory);
    context.data.attempts = context.data.attempts + 1;
    const tooManyAttempts = context.data.attempts > MAX_ATTEMPTS;
    if (tooManyAttempts) {
      context.sendEvent(
        new AgentRunEvent({
          agent: "writer",
          text: `Too many attempts (${MAX_ATTEMPTS}) to write the blog post. Proceeding with the current version.`,
          type: "text",
        }),
      );
    }

    if (ev.data.isGood || tooManyAttempts) {
      // the blog post is good or too many attempts
      // stream the final content
      const result = await runAgent(context, writer, {
        message: `Based on the reviewer's feedback, refine the post and return only the final version of the post. Here's the current version: ${ev.data.input}`,
        displayName: "Writer",
        streaming: true,
      });
      return result as unknown as StopEvent<AsyncGenerator<ChatResponseChunk>>;
    }

    const writeRes = await runAgent(context, writer, {
      message: ev.data.input,
      displayName: "Writer",
      streaming: false,
    });
    const writeResult = writeRes?.data;
    context.data.result = writeResult; // store the last result

    return new ReviewEvent({ input: writeResult });
  };

  const review = async (
    context: HandlerContext<BlogContext>,
    ev: ReviewEvent,
  ) => {
    const reviewer = createReviewer(chatHistory);
    const reviewResult = (await runAgent(context, reviewer, {
      message: ev.data.input,
      displayName: "Reviewer",
      streaming: false,
    })) as unknown as StopEvent<string>;
    const reviewResultStr = reviewResult.data;
    const oldContent = context.data.result;
    const postIsGood = reviewResultStr.toLowerCase().includes("post is good");
    context.sendEvent(
      new AgentRunEvent({
        agent: "reviewer",
        text: `The post is ${postIsGood ? "" : "not "}good enough for publishing. Sending back to the writer${
          postIsGood ? " for publication." : "."
        }`,
        type: "text",
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

  const publish = async (
    context: HandlerContext<BlogContext>,
    ev: PublishEvent,
  ) => {
    const publisher = await createPublisher(chatHistory);

    const publishResult = await runAgent(context, publisher, {
      message: `${ev.data.input}`,
      displayName: "Publisher",
      streaming: true,
    });
    return publishResult as unknown as StopEvent<
      AsyncGenerator<ChatResponseChunk>
    >;
  };

  const workflow: Workflow<
    BlogContext,
    AgentInput,
    string | AsyncGenerator<boolean | ChatResponseChunk>
  > = new Workflow();

  workflow.addStep(
    {
      inputs: [StartEvent<AgentInput>],
      outputs: [ResearchEvent, PublishEvent],
    },
    start,
  );

  workflow.addStep(
    {
      inputs: [ResearchEvent],
      outputs: [WriteEvent],
    },
    research,
  );

  workflow.addStep(
    {
      inputs: [WriteEvent],
      outputs: [ReviewEvent, StopEvent<AsyncGenerator<ChatResponseChunk>>],
    },
    write,
  );

  workflow.addStep(
    {
      inputs: [ReviewEvent],
      outputs: [WriteEvent],
    },
    review,
  );

  workflow.addStep(
    {
      inputs: [PublishEvent],
      outputs: [StopEvent],
    },
    publish,
  );

  // Overload run method to initialize the context
  workflow.run = function (
    input: AgentInput,
  ): WorkflowContext<
    AgentInput,
    string | AsyncGenerator<boolean | ChatResponseChunk>,
    BlogContext
  > {
    return Workflow.prototype.run.call(workflow, new StartEvent(input), {
      task: input.message.toString(),
      attempts: 0,
      result: "",
    });
  };

  return workflow;
};

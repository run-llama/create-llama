import {
  Context,
  StartEvent,
  StopEvent,
  Workflow,
  WorkflowEvent,
} from "@llamaindex/core/workflow";
import { Message } from "ai";
import { ChatMessage, ChatResponseChunk, Settings } from "llamaindex";
import { getAnnotations } from "../llamaindex/streaming/annotations";
import {
  createPublisher,
  createResearcher,
  createReviewer,
  createWriter,
} from "./agents";
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

const prepareChatHistory = (chatHistory: Message[]): ChatMessage[] => {
  // By default, the chat history only contains the assistant and user messages
  // all the agents messages are stored in annotation data which is not visible to the LLM

  const MAX_AGENT_MESSAGES = 10;
  const agentAnnotations = getAnnotations<{ agent: string; text: string }>(
    chatHistory,
    { role: "assistant", type: "agent" },
  ).slice(-MAX_AGENT_MESSAGES);

  const agentMessages = agentAnnotations
    .map(
      (annotation) =>
        `\n<${annotation.data.agent}>\n${annotation.data.text}\n</${annotation.data.agent}>`,
    )
    .join("\n");

  const agentContent = agentMessages
    ? "Here is the previous conversation of agents:\n" + agentMessages
    : "";

  if (agentContent) {
    const agentMessage: ChatMessage = {
      role: "assistant",
      content: agentContent,
    };
    return [
      ...chatHistory.slice(0, -1),
      agentMessage,
      chatHistory.slice(-1)[0],
    ] as ChatMessage[];
  }
  return chatHistory as ChatMessage[];
};

export const createWorkflow = (messages: Message[], params?: any) => {
  const chatHistoryWithAgentMessages = prepareChatHistory(messages);
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

    const chatHistoryStr = chatHistoryWithAgentMessages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    // Decision-making process
    const decision = await decideWorkflow(ev.data.input, chatHistoryStr);

    if (decision !== "publish") {
      return new ResearchEvent({
        input: `Research for this task: ${ev.data.input}`,
      });
    } else {
      return new PublishEvent({
        input: `Publish content based on the chat history\n${chatHistoryStr}\n\n and task: ${ev.data.input}`,
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

  const research = async (context: Context, ev: ResearchEvent) => {
    const researcher = await createResearcher(
      chatHistoryWithAgentMessages,
      params,
    );
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
    const writer = createWriter(chatHistoryWithAgentMessages);

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
      // the blog post is good or too many attempts
      // stream the final content
      const result = await runAgent(context, writer, {
        message: `Based on the reviewer's feedback, refine the post and return only the final version of the post. Here's the current version: ${ev.data.input}`,
        streaming: true,
      });
      return result as unknown as StopEvent<AsyncGenerator<ChatResponseChunk>>;
    }

    const writeRes = await runAgent(context, writer, {
      message: ev.data.input,
    });
    const writeResult = writeRes.data.result;
    context.set("result", writeResult); // store the last result
    return new ReviewEvent({ input: writeResult });
  };

  const review = async (context: Context, ev: ReviewEvent) => {
    const reviewer = createReviewer(chatHistoryWithAgentMessages);
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

  const publish = async (context: Context, ev: PublishEvent) => {
    const publisher = await createPublisher(chatHistoryWithAgentMessages);

    const publishResult = await runAgent(context, publisher, {
      message: `${ev.data.input}`,
      streaming: true,
    });
    return publishResult as unknown as StopEvent<
      AsyncGenerator<ChatResponseChunk>
    >;
  };

  const workflow = new Workflow({ timeout: TIMEOUT, validate: true });
  workflow.addStep(StartEvent, start, {
    outputs: [ResearchEvent, PublishEvent],
  });
  workflow.addStep(ResearchEvent, research, { outputs: WriteEvent });
  workflow.addStep(WriteEvent, write, { outputs: [ReviewEvent, StopEvent] });
  workflow.addStep(ReviewEvent, review, { outputs: WriteEvent });
  workflow.addStep(PublishEvent, publish, { outputs: StopEvent });

  return workflow;
};

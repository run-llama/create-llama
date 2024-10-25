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
import { createAnalyst, createReporter, createResearcher } from "./agents";
import { AgentInput, AgentRunEvent } from "./type";

const TIMEOUT = 360 * 1000;
const MAX_ATTEMPTS = 2;

class ResearchEvent extends WorkflowEvent<{ input: string }> {}
class AnalyzeEvent extends WorkflowEvent<{ input: string }> {}
class ReportEvent extends WorkflowEvent<{ input: string }> {}

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
      return new ReportEvent({
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
    return new AnalyzeEvent({
      input: `Write a blog post given this task: ${context.get("task")} using this research content: ${researchResult}`,
    });
  };

  const analyze = async (context: Context, ev: AnalyzeEvent) => {
    const analyst = await createAnalyst(chatHistoryWithAgentMessages);
    const analyzeRes = await runAgent(context, analyst, {
      message: ev.data.input,
    });
    return new ReportEvent({
      input: `Publish content based on the chat history\n${analyzeRes.data.result}\n\n and task: ${ev.data.input}`,
    });
  };

  const report = async (context: Context, ev: ReportEvent) => {
    const reporter = await createReporter(chatHistoryWithAgentMessages);

    const reportResult = await runAgent(context, reporter, {
      message: `${ev.data.input}`,
      streaming: true,
    });
    return reportResult as unknown as StopEvent<
      AsyncGenerator<ChatResponseChunk>
    >;
  };

  const workflow = new Workflow({ timeout: TIMEOUT, validate: true });
  workflow.addStep(StartEvent, start, {
    outputs: [ResearchEvent, ReportEvent],
  });
  workflow.addStep(ResearchEvent, research, { outputs: AnalyzeEvent });
  workflow.addStep(AnalyzeEvent, analyze, { outputs: ReportEvent });
  workflow.addStep(ReportEvent, report, { outputs: StopEvent });

  return workflow;
};

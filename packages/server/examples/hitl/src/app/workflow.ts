import { OpenAI } from "@llamaindex/openai";
import { toAgentRunEvent, writeResponseToStream } from "@llamaindex/server";
import { chatWithTools } from "@llamaindex/tools";
import {
  createWorkflow,
  getContext,
  startAgentEvent,
  stopAgentEvent,
  withSnapshot,
  workflowEvent,
} from "@llamaindex/workflow";
import { ChatMessage, Settings, ToolCallLLM } from "llamaindex";
import { cliHumanInputEvent, cliHumanResponseEvent } from "./events";
import { cliExecutor } from "./tools";

Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
});

const summaryEvent = workflowEvent<string>(); // simple event to summarize the result

export const workflowFactory = (body: unknown) => {
  const llm = Settings.llm as ToolCallLLM;

  if (!llm.supportToolCall) {
    throw new Error("LLM is not a ToolCallLLM");
  }

  const { messages } = body as { messages: ChatMessage[] };

  const workflow = withSnapshot(createWorkflow());

  workflow.handle([startAgentEvent], async ({ data }) => {
    const { userInput, chatHistory = [] } = data;
    if (!userInput) {
      throw new Error("User input is required");
    }

    // in this example, we use chatWithTools to decide should perform a tool call or not
    // if cli executor is called, emit HumanInputEvent to ask user for permission
    const toolCallResponse = await chatWithTools(
      llm,
      [cliExecutor],
      chatHistory.concat({ role: "user", content: userInput }),
    );
    const cliExecutorToolCall = toolCallResponse.toolCalls.find(
      (toolCall) => toolCall.name === cliExecutor.metadata.name,
    );
    const command = cliExecutorToolCall?.input?.command as string;
    if (command) {
      return cliHumanInputEvent.with({
        type: "cli_human_input",
        data: { command },
        response: cliHumanResponseEvent,
      });
    }

    // if no tool call, just response as normal
    return summaryEvent.with("");
  });

  // do actions after getting response from human
  workflow.handle([cliHumanResponseEvent], async ({ data }) => {
    const { sendEvent } = getContext();
    const { command, execute } = data.data;

    if (!execute) {
      // stop the workflow if user reject to execute the command
      return summaryEvent.with(`User reject to execute the command ${command}`);
    }

    sendEvent(
      toAgentRunEvent({
        agent: "CLI Executor",
        text: `Execute the command "${command}" and return the result`,
        type: "text",
      }),
    );

    const result = (await cliExecutor.call({ command })) as string;

    return summaryEvent.with(
      `Executed the command ${command} and got the result: ${result}`,
    );
  });

  workflow.handle([summaryEvent], async ({ data: summaryResult }) => {
    const { sendEvent } = getContext();

    const chatHistory = messages;
    if (summaryResult) {
      chatHistory.push({ role: "user", content: summaryResult });
    }

    const stream = await llm.chat({
      messages: chatHistory,
      stream: true,
    });

    const result = await writeResponseToStream(stream, sendEvent);

    return stopAgentEvent.with({ result });
  });

  return workflow;
};

import { OpenAI } from "@llamaindex/openai";
import {
  humanInputEvent,
  humanInputEventSchema,
  humanResponseEvent,
  toAgentRunEvent,
  writeResponseToStream,
} from "@llamaindex/server";
import { chatWithTools } from "@llamaindex/tools";
import {
  createStatefulMiddleware,
  createWorkflow,
  startAgentEvent,
  stopAgentEvent,
  withSnapshot,
  workflowEvent,
} from "@llamaindex/workflow";
import {
  ChatMemoryBuffer,
  ChatMessage,
  Settings,
  ToolCallLLM,
} from "llamaindex";
import { z } from "zod";
import { cliExecutor } from "./tools";

Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
});

const cliHumanInputEventSchema = humanInputEventSchema.extend({
  data: z.object({
    execute: z.boolean(),
    command: z.string(),
  }),
});

const summaryEvent = workflowEvent<string>(); // simple event to summarize the result

export const workflowFactory = (body: unknown) => {
  const llm = Settings.llm as ToolCallLLM;
  if (!llm.supportToolCall) {
    throw new Error("LLM is not a ToolCallLLM");
  }

  const { messages } = body as { messages: ChatMessage[] };

  const { withState, getContext } = createStatefulMiddleware(() => ({
    memory: new ChatMemoryBuffer({ llm, chatHistory: messages }),
  }));

  const workflow = withSnapshot(withState(createWorkflow()));

  workflow.handle([startAgentEvent], async ({ data }) => {
    const { sendEvent } = getContext();
    const { userInput, chatHistory = [] } = data;

    // Prepare chat history
    if (!userInput) {
      throw new Error("Missing user input to start the workflow");
    }

    const toolCallResponse = await chatWithTools(
      llm,
      [cliExecutor],
      chatHistory.concat([{ role: "user", content: userInput }]),
    );

    // if cli executor is called, emit HumanInputEvent to ask user for permission
    const cliExecutorToolCall = toolCallResponse.toolCalls.find(
      (toolCall) => toolCall.name === cliExecutor.metadata.name,
    );
    const command = cliExecutorToolCall?.input?.command;
    if (command) {
      sendEvent(
        toAgentRunEvent({
          agent: "CLI Executor",
          text: `Execute the command "${command}" and return the result`,
          type: "text",
        }),
      );
      return humanInputEvent.with({
        data: { command },
        type: "cli_human_input",
      });
    }

    // if no tool call, just response as normal
    return summaryEvent.with("No need to execute any command");
  });

  workflow.handle([humanResponseEvent], async ({ data }) => {
    const parsedData = cliHumanInputEventSchema.safeParse(data);
    if (!parsedData.success) {
      throw new Error("Invalid human input event data");
    }
    const { command, execute } = parsedData.data.data;

    if (!execute) {
      // stop the workflow if user reject to execute the command
      return summaryEvent.with(`User reject to execute the command ${command}`);
    }

    const result = (await cliExecutor.call({ command })) as string;
    return summaryEvent.with(
      `Execute the command ${command} and return the result: ${result}`,
    );
  });

  workflow.handle([summaryEvent], async ({ data: summaryResult }) => {
    const { state, sendEvent } = getContext();

    const chatHistory = await state.memory.getMessages();
    const stream = await llm.chat({
      messages: chatHistory.concat([{ role: "user", content: summaryResult }]),
      stream: true,
    });
    const response = await writeResponseToStream(stream, sendEvent);
    return stopAgentEvent.with({ result: response });
  });

  return workflow;
};

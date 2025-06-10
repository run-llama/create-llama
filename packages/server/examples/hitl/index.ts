import { OpenAI } from "@llamaindex/openai";
import {
  humanInputEvent,
  humanResponseEvent,
  LlamaIndexServer,
  toAsyncGenerator,
  writeResponseToStream,
} from "@llamaindex/server";
import { chatWithTools } from "@llamaindex/tools";
import {
  createWorkflow,
  getContext,
  startAgentEvent,
  stopAgentEvent,
  withSnapshot,
} from "@llamaindex/workflow";
import { Settings, ToolCallLLM } from "llamaindex";
import { cliExecutor } from "./tools";

Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
});

type CLIHumanResponseEventData = {
  execute: boolean;
  command: string;
};

const workflowFactory = () => {
  const llm = Settings.llm as ToolCallLLM;
  if (!llm.supportToolCall) {
    throw new Error("LLM is not a ToolCallLLM");
  }

  const workflow = withSnapshot(createWorkflow());

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

    // if no tool call, just response as normal
    if (!toolCallResponse.hasToolCall() && toolCallResponse.responseGenerator) {
      const generator = toolCallResponse.responseGenerator;
      const response = await writeResponseToStream(generator, sendEvent);
      return stopAgentEvent.with({ result: response });
    }

    // if cli executor is called, emit HumanInputEvent
    const cliExecutorToolCall = toolCallResponse.toolCalls.find(
      (toolCall) => toolCall.name === cliExecutor.metadata.name,
    );
    if (cliExecutorToolCall?.input?.command) {
      console.log("cliExecutorToolCall", cliExecutorToolCall?.input?.command);
      return humanInputEvent.with({
        data: {
          command: cliExecutorToolCall.input.command as string,
        },
        type: "cli_human_input",
      });
    }

    // stop the workflow if invalid tool call
    return stopAgentEvent.with({ result: "Invalid tool call" });
  });

  workflow.handle([humanResponseEvent], async ({ data }) => {
    const { sendEvent } = getContext();

    const { command, execute } = data as CLIHumanResponseEventData;

    console.log("humanResponseEvent", data, command, execute);

    if (!command || !execute) {
      // stop the workflow if user reject to execute the command
      return stopAgentEvent.with({
        result: "User reject to execute the command",
      });
    }

    const result = await cliExecutor.call({ command });
    const stream = await llm.chat({
      // TODO: add other history here
      messages: [
        {
          role: "assistant",
          content: `The result of the command "${command}" is ${result}`,
        },
      ],
      stream: true,
    });
    const generator = toAsyncGenerator(stream);
    const response = await writeResponseToStream(generator, sendEvent);
    return stopAgentEvent.with({ result: response });
  });

  return workflow;
};

new LlamaIndexServer({
  workflow: workflowFactory,
  uiConfig: {
    starterQuestions: [
      "List all files in the current directory",
      "Fetch changes from the remote repository",
    ],
    componentsDir: "components",
  },
  port: 3000,
}).start();

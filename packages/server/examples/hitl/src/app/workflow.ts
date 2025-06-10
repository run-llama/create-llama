import { OpenAI } from "@llamaindex/openai";
import {
  humanInputEvent,
  humanResponseEvent,
  humanResponseEventSchema,
  writeResponseToStream,
} from "@llamaindex/server";
import { chatWithTools } from "@llamaindex/tools";
import {
  agentStreamEvent,
  createWorkflow,
  getContext,
  startAgentEvent,
  stopAgentEvent,
  withSnapshot,
} from "@llamaindex/workflow";
import { Settings, ToolCallLLM } from "llamaindex";
import { z } from "zod";
import { cliExecutor } from "./tools";

Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
});

export const cliHumanResponseEventSchema = humanResponseEventSchema.extend({
  data: z.object({
    execute: z.boolean(),
    command: z.string(),
  }),
});

type CLIHumanResponseEventData = z.infer<typeof cliHumanResponseEventSchema>;

export const workflowFactory = () => {
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
    const command = cliExecutorToolCall?.input?.command;
    if (command) {
      return humanInputEvent.with({
        data: { command },
        type: "cli_human_input",
      });
    }

    // stop the workflow if invalid tool call
    return stopAgentEvent.with({ result: "Invalid tool call" });
  });

  workflow.handle([humanResponseEvent], async ({ data }) => {
    const parsedData = cliHumanResponseEventSchema.safeParse(data);
    if (!parsedData.success) {
      return stopAgentEvent.with({
        result: "Invalid input data for human response event",
      });
    }

    const { sendEvent } = getContext();
    const { command, execute } = parsedData.data;

    if (!execute) {
      // stop the workflow if user reject to execute the command
      return stopAgentEvent.with({
        result: "User reject to execute the command",
      });
    }

    const result = await cliExecutor.execute(command);
    const stream = await llm.chat({
      messages: [
        {
          role: "user",
          content: `Execute the command "${command}" and return the result: ${result}`,
        },
      ],
      stream: true,
    });

    let response = "";
    for await (const chunk of stream) {
      response += chunk.delta;
      sendEvent(
        agentStreamEvent.with({
          delta: chunk.delta,
          response,
          currentAgentName: "",
          raw: stream,
        }),
      );
    }

    return stopAgentEvent.with({ result: response });
  });

  return workflow;
};

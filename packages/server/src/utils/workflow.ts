import { LlamaIndexAdapter, StreamData, type JSONValue } from "ai";
import type {
  ChatResponseChunk,
  EngineResponse,
  Metadata,
  NodeWithScore,
  WorkflowEventData,
  WorkflowStream,
} from "llamaindex";
import {
  agentStreamEvent,
  agentToolCallEvent,
  agentToolCallResultEvent,
  AgentWorkflow,
  LLamaCloudFileService,
  startAgentEvent,
  stopAgentEvent,
  type AgentInputData,
} from "llamaindex";
import { ReadableStream } from "stream/web";
import {
  sourceEvent,
  toAgentRunEvent,
  toSourceEvent,
  type SourceEventNode,
} from "../events";
import { type ServerWorkflow } from "../types";
import { downloadFile } from "./file";
import { sendSuggestedQuestionsEvent } from "./suggestion";

export async function runWorkflow(
  workflow: ServerWorkflow,
  input: AgentInputData,
) {
  const dataStream = new StreamData();

  let workflowStream:
    | AsyncIterable<WorkflowEventData<unknown>>
    | WorkflowStream;
  if (!input.userInput) {
    throw new Error("Missing user input to start the workflow");
  }
  if (workflow instanceof AgentWorkflow) {
    workflowStream = workflow.runStream(input.userInput, {
      chatHistory: input.chatHistory ?? [],
    });
  } else {
    // TODO: Refactor this using stream API from llamaindex once it's ready
    const { stream, sendEvent } = workflow.createContext();
    sendEvent(
      startAgentEvent.with({
        userInput: input.userInput,
        chatHistory: input.chatHistory,
      }),
    );
    workflowStream = stream;
  }

  const stream = new ReadableStream<EngineResponse>({
    async pull(controller) {
      try {
        for await (const event of workflowStream) {
          if (stopAgentEvent.include(event)) {
            controller.close();
            return;
          }
          if (agentStreamEvent.include(event)) {
            if (event.data.delta) {
              controller.enqueue({
                delta: event.data.delta,
              } as EngineResponse);
            }
          } else {
            appendEventDataToAnnotations(dataStream, event);
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";
        controller.enqueue({ delta: errorMessage } as EngineResponse);
        dataStream.close();
      } finally {
        controller.close();
      }
    },
  });

  return LlamaIndexAdapter.toDataStreamResponse(stream, {
    data: dataStream,
    callbacks: {
      onFinal: async (content: string) => {
        const history = input.chatHistory?.concat({
          role: "assistant",
          content,
        });
        await sendSuggestedQuestionsEvent(dataStream, history);
        dataStream.close();
      },
    },
  });
}

// append data of other events to the data stream as message annotations
function appendEventDataToAnnotations(
  dataStream: StreamData,
  event: WorkflowEventData<unknown>,
) {
  const transformedEvent = transformWorkflowEvent(event);
  // for SourceEvent, we need to trigger download files from LlamaCloud (if having)
  if (sourceEvent.include(transformedEvent)) {
    const sourceNodes = transformedEvent.data.data.nodes;
    downloadLlamaCloudFilesFromNodes(sourceNodes); // download files in background
  }
  dataStream.appendMessageAnnotation(transformedEvent.data as JSONValue);
}

// transform WorkflowEvent to another WorkflowEvent for annotations display purpose
// this useful for handling AgentWorkflow events, because we cannot easily append custom events like custom workflows
function transformWorkflowEvent(
  event: WorkflowEventData<unknown>,
): WorkflowEventData<unknown> {
  // convert AgentToolCall event to AgentRunEvent
  if (agentToolCallEvent.include(event)) {
    const inputString = JSON.stringify(event.data.toolKwargs);
    return toAgentRunEvent({
      agent: event.data.agentName,
      text: `Using tool: '${event.data.toolName}' with inputs: '${inputString}'`,
      type: "text",
    });
  }

  // modify AgentToolCallResult event
  if (agentToolCallResultEvent.include(event)) {
    const rawOutput = event.data.raw;

    // if AgentToolCallResult contains sourceNodes, convert it to SourceEvent
    if (
      rawOutput &&
      typeof rawOutput === "object" &&
      "sourceNodes" in rawOutput // TODO: better use Zod to validate and extract sourceNodes from toolCallResult
    ) {
      return toSourceEvent(
        rawOutput.sourceNodes as unknown as NodeWithScore<Metadata>[],
      );
    }
  }

  return event;
}

async function downloadLlamaCloudFilesFromNodes(nodes: SourceEventNode[]) {
  const downloadedFiles: string[] = [];

  for (const node of nodes) {
    if (!node.url || !node.filePath) continue; // skip if url or filePath is not available
    if (downloadedFiles.includes(node.filePath)) continue; // skip if file already downloaded
    if (!node.metadata.pipeline_id) continue; // only download files from LlamaCloud

    const downloadUrl = await LLamaCloudFileService.getFileUrl(
      node.metadata.pipeline_id,
      node.fileName,
    );
    if (!downloadUrl) continue;

    await downloadFile(downloadUrl, node.filePath);

    downloadedFiles.push(node.filePath);
  }
}

export async function* toStreamGenerator(
  input: AsyncIterable<ChatResponseChunk> | string,
): AsyncGenerator<ChatResponseChunk> {
  if (typeof input === "string") {
    yield { delta: input } as ChatResponseChunk;
    return;
  }

  for await (const chunk of input) {
    yield chunk;
  }
}

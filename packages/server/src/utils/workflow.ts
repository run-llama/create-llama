import {
  agentToolCallEvent,
  agentToolCallResultEvent,
  run,
  startAgentEvent,
  type AgentInputData,
  type WorkflowEventData,
} from "@llamaindex/workflow";
import {
  LLamaCloudFileService,
  type Metadata,
  type NodeWithScore,
} from "llamaindex";
import {
  sourceEvent,
  toAgentRunEvent,
  toSourceEvent,
  type SourceEventNode,
} from "../events";
import { type ServerWorkflow } from "../types";
import { downloadFile } from "./file";
import { toDataStreamResponse } from "./stream";
import { sendSuggestedQuestionsEvent } from "./suggestion";

export async function runWorkflow(
  workflow: ServerWorkflow,
  input: AgentInputData,
) {
  if (!input.userInput) {
    throw new Error("Missing user input to start the workflow");
  }
  const workflowStream = run(workflow, [
    startAgentEvent.with({
      userInput: input.userInput,
      chatHistory: input.chatHistory,
    }),
  ]);

  // Transform the stream to handle annotations
  const transformedStream = processWorkflowStream(workflowStream);

  return toDataStreamResponse(transformedStream, {
    // TODO: Fix me
    callbacks: {
      onFinal: (streamWriter, content) => {
        sendSuggestedQuestionsEvent(streamWriter, input.chatHistory);
      },
    },
  });
}

// Process the workflow stream to handle non-stream events as annotations
async function* processWorkflowStream(
  stream: AsyncIterable<WorkflowEventData<unknown>>,
): AsyncIterable<WorkflowEventData<unknown>> {
  for await (const event of stream) {
    const transformedEvent = transformWorkflowEvent(event);

    if (sourceEvent.include(transformedEvent)) {
      const sourceNodes = transformedEvent.data.data.nodes;
      downloadLlamaCloudFilesFromNodes(sourceNodes); // download files in background
    }
    yield transformedEvent;
  }
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

  // if AgentToolCallResult contains sourceNodes, convert it to SourceEvent
  if (agentToolCallResultEvent.include(event)) {
    const rawOutput = event.data.raw;
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

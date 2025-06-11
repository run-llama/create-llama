import {
  agentToolCallEvent,
  agentToolCallResultEvent,
  startAgentEvent,
  stopAgentEvent,
  WorkflowStream,
  type AgentInputData,
  type Workflow,
  type WorkflowContext,
  type WorkflowEventData,
} from "@llamaindex/workflow";
import {
  LLamaCloudFileService,
  type Metadata,
  type NodeWithScore,
} from "llamaindex";
import {
  artifactEvent,
  sourceEvent,
  toAgentRunEvent,
  toSourceEvent,
  type SourceEventNode,
} from "./events";
import { downloadFile } from "./file";
import {
  resumeWorkflowFromHumanResponses,
  type HumanResponseEventData,
} from "./hitl/index";
import { toInlineAnnotationEvent } from "./inline";

export async function runWorkflow({
  workflow,
  input,
  humanResponses,
  requestId,
  abortSignal,
}: {
  workflow: Workflow;
  input: AgentInputData;
  humanResponses?: HumanResponseEventData[];
  requestId?: string | undefined;
  abortSignal?: AbortSignal;
}): Promise<{
  stream: WorkflowStream<WorkflowEventData<unknown>>;
  context: WorkflowContext;
}> {
  let context: WorkflowContext;
  if (humanResponses?.length) {
    // resume the workflow if there is human response
    context = await resumeWorkflowFromHumanResponses(
      workflow,
      humanResponses,
      requestId,
    );
  } else {
    // otherwise, create a new empty context and run the workflow with startAgentEvent
    context = workflow.createContext();
    context.sendEvent(
      startAgentEvent.with({
        userInput: input.userInput,
        chatHistory: input.chatHistory,
      }),
    );
  }

  // Transform the stream to handle annotations
  const stream = processWorkflowStream(context.stream).until(
    (event) => abortSignal?.aborted || stopAgentEvent.include(event),
  );

  return { stream, context };
}

export function processWorkflowStream(
  stream: WorkflowStream<WorkflowEventData<unknown>>,
) {
  return stream.pipeThrough(
    new TransformStream<WorkflowEventData<unknown>, WorkflowEventData<unknown>>(
      {
        async transform(event, controller) {
          let transformedEvent = event;

          // Handle agent events from AgentToolCall
          if (agentToolCallEvent.include(event)) {
            const inputString = JSON.stringify(event.data.toolKwargs);
            transformedEvent = toAgentRunEvent({
              agent: event.data.agentName,
              text: `Using tool: '${event.data.toolName}' with inputs: '${inputString}'`,
              type: "text",
            });
          }
          // Handle source nodes from AgentToolCallResult
          else if (agentToolCallResultEvent.include(event)) {
            const rawOutput = event.data.raw;
            if (
              rawOutput &&
              typeof rawOutput === "object" &&
              "sourceNodes" in rawOutput // TODO: better use Zod to validate and extract sourceNodes from toolCallResult
            ) {
              const sourceNodes =
                rawOutput.sourceNodes as unknown as NodeWithScore<Metadata>[];
              transformedEvent = toSourceEvent(sourceNodes);
            }
          }
          // Handle artifact events, transform to agentStreamEvent
          else if (artifactEvent.include(event)) {
            transformedEvent = toInlineAnnotationEvent(event);
          }
          // Post-process for llama-cloud files
          if (sourceEvent.include(transformedEvent)) {
            const sourceNodesForDownload = transformedEvent.data.data.nodes; // These are SourceEventNode[]
            downloadLlamaCloudFilesFromNodes(sourceNodesForDownload); // download files in background
          }

          controller.enqueue(transformedEvent);
        },
      },
    ),
  );
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

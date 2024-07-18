import { StreamData } from "ai";
import {
  CallbackManager,
  Metadata,
  NodeWithScore,
  ToolCall,
  ToolOutput,
} from "llamaindex";
import { LLamaCloudFileService } from "./service";

export async function appendSourceData(
  data: StreamData,
  sourceNodes?: NodeWithScore<Metadata>[],
) {
  if (!sourceNodes?.length) return;
  try {
    const nodes = await Promise.all(
      sourceNodes.map(async (node) => ({
        ...node.node.toMutableJSON(),
        id: node.node.id_,
        score: node.score ?? null,
        url: await getNodeUrl(node.node.metadata),
      })),
    );
    data.appendMessageAnnotation({
      type: "sources",
      data: {
        nodes,
      },
    });
  } catch (error) {
    console.error("Error appending source data:", error);
  }
}

export function appendEventData(data: StreamData, title?: string) {
  if (!title) return;
  data.appendMessageAnnotation({
    type: "events",
    data: {
      title,
    },
  });
}

export function appendToolData(
  data: StreamData,
  toolCall: ToolCall,
  toolOutput: ToolOutput,
) {
  data.appendMessageAnnotation({
    type: "tools",
    data: {
      toolCall: {
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input,
      },
      toolOutput: {
        output: toolOutput.output,
        isError: toolOutput.isError,
      },
    },
  });
}

export function createStreamTimeout(stream: StreamData) {
  const timeout = Number(process.env.STREAM_TIMEOUT ?? 1000 * 60 * 5); // default to 5 minutes
  const t = setTimeout(() => {
    appendEventData(stream, `Stream timed out after ${timeout / 1000} seconds`);
    stream.close();
  }, timeout);
  return t;
}

export function createCallbackManager(stream: StreamData) {
  const callbackManager = new CallbackManager();

  callbackManager.on("retrieve-end", async (data) => {
    const { nodes, query } = data.detail;
    await appendSourceData(stream, nodes);
    appendEventData(stream, `Retrieving context for query: '${query}'`);
    appendEventData(
      stream,
      `Retrieved ${nodes.length} sources to use as context for the query`,
    );
  });

  callbackManager.on("llm-tool-call", (event) => {
    const { name, input } = event.detail.toolCall;
    const inputString = Object.entries(input)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
    appendEventData(
      stream,
      `Using tool: '${name}' with inputs: '${inputString}'`,
    );
  });

  callbackManager.on("llm-tool-result", (event) => {
    const { toolCall, toolResult } = event.detail;
    appendToolData(stream, toolCall, toolResult);
  });

  return callbackManager;
}

async function getNodeUrl(metadata: Metadata) {
  if (!process.env.FILESERVER_URL_PREFIX) {
    console.warn(
      "FILESERVER_URL_PREFIX is not set. File URLs will not be generated.",
    );
  }
  const fileName = metadata["file_name"];
  if (fileName && process.env.FILESERVER_URL_PREFIX) {
    // file_name exists and file server is configured
    const isLocalFile = metadata["is_local_file"] === "true";
    const pipelineId = metadata["pipeline_id"];
    if (pipelineId && !isLocalFile) {
      // file is from LlamaCloud and was not ingested locally
      // TODO trigger but don't await file download and just use convention to generate the URL (see Python code)
      // return `${process.env.FILESERVER_URL_PREFIX}/output/llamacloud/${pipelineId}\$${fileName}`;
      return await LLamaCloudFileService.getFileUrl(fileName, pipelineId);
    }
    const isPrivate = metadata["private"] === "true";
    const folder = isPrivate ? "output/uploaded" : "data";
    return `${process.env.FILESERVER_URL_PREFIX}/${folder}/${fileName}`;
  }
  // fallback to URL in metadata (e.g. for websites)
  return metadata["URL"];
}

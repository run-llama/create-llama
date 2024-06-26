import {
  JSONValue,
  StreamData,
  createCallbacksTransformer,
  createStreamDataTransformer,
  trimStartOfStreamHelper,
  type AIStreamCallbacksAndOptions,
} from "ai";
import {
  MessageContent,
  MessageContentDetail,
  Metadata,
  NodeWithScore,
  Response,
  ToolCallLLMMessageOptions,
} from "llamaindex";

import { AgentStreamChatResponse } from "llamaindex/agent/base";
import { ContentFile, appendSourceData } from "./stream-helper";

type LlamaIndexResponse =
  | AgentStreamChatResponse<ToolCallLLMMessageOptions>
  | Response;

export const convertMessageContent = (
  content: string,
  annotations?: JSONValue[],
): MessageContent => {
  if (!annotations) return content;
  return [
    {
      type: "text",
      text: content,
    },
    ...convertAnnotations(annotations),
  ];
};

const convertAnnotations = (
  annotations: JSONValue[],
): MessageContentDetail[] => {
  const content: MessageContentDetail[] = [];
  annotations.forEach((annotation: JSONValue) => {
    // first skip invalid annotation
    if (
      !(
        annotation &&
        typeof annotation === "object" &&
        "type" in annotation &&
        "data" in annotation &&
        annotation.data &&
        typeof annotation.data === "object"
      )
    ) {
      console.log(
        "Client sent invalid annotation. Missing data and type",
        annotation,
      );
      return;
    }
    const { type, data } = annotation;
    // convert image
    if (type === "image" && "url" in data && typeof data.url === "string") {
      content.push({
        type: "image_url",
        image_url: {
          url: data.url,
        },
      });
    }
    // convert files to text
    if (
      type === "content_file" &&
      "files" in data &&
      Array.isArray(data.files)
    ) {
      const rawContents = data.files.map((file) => {
        const { filetype, content } = file as ContentFile;
        return "```" + `${filetype}\n${content}\n` + "```";
      });
      const fileContent =
        `Use data from following raw contents:\n` + rawContents.join("\n\n");
      content.push({
        type: "text",
        text: fileContent,
      });
    }
  });

  return content;
};

function createParser(
  res: AsyncIterable<LlamaIndexResponse>,
  data: StreamData,
) {
  const it = res[Symbol.asyncIterator]();
  const trimStartOfStream = trimStartOfStreamHelper();

  let sourceNodes: NodeWithScore<Metadata>[] | undefined;
  return new ReadableStream<string>({
    async pull(controller): Promise<void> {
      const { value, done } = await it.next();
      if (done) {
        if (sourceNodes) {
          appendSourceData(data, sourceNodes);
        }
        controller.close();
        data.close();
        return;
      }

      let delta;
      if (value instanceof Response) {
        // handle Response type
        if (value.sourceNodes) {
          // get source nodes from the first response
          sourceNodes = value.sourceNodes;
        }
        delta = value.response ?? "";
      } else {
        // handle other types
        delta = value.response.delta;
      }
      const text = trimStartOfStream(delta ?? "");
      if (text) {
        controller.enqueue(text);
      }
    },
  });
}

export function LlamaIndexStream(
  response: AsyncIterable<LlamaIndexResponse>,
  data: StreamData,
  opts?: {
    callbacks?: AIStreamCallbacksAndOptions;
  },
): ReadableStream<Uint8Array> {
  return createParser(response, data)
    .pipeThrough(createCallbacksTransformer(opts?.callbacks))
    .pipeThrough(createStreamDataTransformer());
}

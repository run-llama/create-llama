import {
  JSONValue,
  StreamData,
  createCallbacksTransformer,
  createStreamDataTransformer,
  trimStartOfStreamHelper,
  type AIStreamCallbacksAndOptions,
} from "ai";
import {
  EngineResponse,
  MessageContent,
  MessageContentDetail,
} from "llamaindex";

import { CsvFile } from "./stream-helper";

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
    // convert CSV files to text
    if (type === "csv" && "csvFiles" in data && Array.isArray(data.csvFiles)) {
      const rawContents = data.csvFiles.map((csv) => {
        return "```csv\n" + (csv as CsvFile).content + "\n```";
      });
      const csvContent =
        "Use data from following CSV raw contents:\n" +
        rawContents.join("\n\n");
      content.push({
        type: "text",
        text: csvContent,
      });
    }
  });

  return content;
};

function createParser(res: AsyncIterable<EngineResponse>, data: StreamData) {
  const it = res[Symbol.asyncIterator]();
  const trimStartOfStream = trimStartOfStreamHelper();

  return new ReadableStream<string>({
    async pull(controller): Promise<void> {
      const { value, done } = await it.next();
      if (done) {
        controller.close();
        data.close();
        return;
      }
      const text = trimStartOfStream(value.delta ?? "");
      if (text) {
        controller.enqueue(text);
      }
    },
  });
}

export function LlamaIndexStream(
  response: AsyncIterable<EngineResponse>,
  data: StreamData,
  opts?: {
    callbacks?: AIStreamCallbacksAndOptions;
  },
): ReadableStream<Uint8Array> {
  return createParser(response, data)
    .pipeThrough(createCallbacksTransformer(opts?.callbacks))
    .pipeThrough(createStreamDataTransformer());
}

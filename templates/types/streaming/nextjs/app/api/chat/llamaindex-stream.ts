import {
  StreamData,
  createCallbacksTransformer,
  createStreamDataTransformer,
  trimStartOfStreamHelper,
  type AIStreamCallbacksAndOptions,
} from "ai";
import {
  MessageContent,
  Metadata,
  NodeWithScore,
  Response,
  ToolCallLLMMessageOptions,
} from "llamaindex";

import { AgentStreamChatResponse } from "llamaindex/agent/base";
import path from "path";
import {
  CsvFile,
  appendCsvData,
  appendImageData,
  appendSourceData,
  writeTempCsvFiles,
} from "./stream-helper";

type LlamaIndexResponse =
  | AgentStreamChatResponse<ToolCallLLMMessageOptions>
  | Response;

export type DataParserOptions = {
  imageUrl?: string;
  csvFiles?: CsvFile[];
};

export const convertMessageContent = (
  textMessage: string,
  additionalData?: DataParserOptions,
): MessageContent => {
  if (!additionalData) return textMessage;
  const content: MessageContent = [
    {
      type: "text",
      text: textMessage,
    },
  ];
  if (additionalData?.imageUrl) {
    content.push({
      type: "image_url",
      image_url: {
        url: additionalData?.imageUrl,
      },
    });
  }

  if (additionalData?.csvFiles?.length) {
    const tmpFile = writeTempCsvFiles(additionalData.csvFiles);
    // Get a few lines of the CSV file as sample content
    const sampleContent = additionalData.csvFiles
      .map((csv) => csv.content.split("\n").slice(1, 4).join("\n"))
      .join("\n\n");
    const metadata = {
      localFilePath: tmpFile.name,
      sampleContent: sampleContent,
      sandboxFilePath: `/home/user/${path.basename(tmpFile.name)}`,
    };
    const csvContent =
      "Provided CSV file metadata:\n" + JSON.stringify(metadata, null, 2);
    console.log(csvContent);
    content.push({
      type: "text",
      text: `${textMessage}\n\n${csvContent}`,
    });
  }

  return content;
};

function createParser(
  res: AsyncIterable<LlamaIndexResponse>,
  data: StreamData,
  opts?: DataParserOptions,
) {
  const it = res[Symbol.asyncIterator]();
  const trimStartOfStream = trimStartOfStreamHelper();

  let sourceNodes: NodeWithScore<Metadata>[] | undefined;
  return new ReadableStream<string>({
    start() {
      appendImageData(data, opts?.imageUrl);
      appendCsvData(data, opts?.csvFiles);
    },
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
    parserOptions?: DataParserOptions;
  },
): ReadableStream<Uint8Array> {
  return createParser(response, data, opts?.parserOptions)
    .pipeThrough(createCallbacksTransformer(opts?.callbacks))
    .pipeThrough(createStreamDataTransformer());
}

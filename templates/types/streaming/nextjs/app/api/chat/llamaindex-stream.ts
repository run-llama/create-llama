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
import { CsvFile, appendSourceData } from "./stream-helper";

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
    const rawContents = additionalData.csvFiles.map((csv) => {
      return "```csv\n" + csv.content + "\n```";
    });
    const csvContent =
      "Use data from following CSV raw contents:\n" + rawContents.join("\n\n");
    content.push({
      type: "text",
      text: `${csvContent}\n\n${textMessage}`,
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

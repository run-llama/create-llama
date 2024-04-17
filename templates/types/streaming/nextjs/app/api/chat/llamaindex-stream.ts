import {
  StreamData,
  createCallbacksTransformer,
  createStreamDataTransformer,
  trimStartOfStreamHelper,
  type AIStreamCallbacksAndOptions,
} from "ai";
import {
  Metadata,
  NodeWithScore,
  Response,
  StreamingAgentChatResponse,
} from "llamaindex";
import { appendImageData, appendSourceData } from "./stream-helper";

type ParserOptions = {
  image_url?: string;
};

function createParser(
  res: AsyncIterable<Response>,
  data: StreamData,
  opts?: ParserOptions,
) {
  const it = res[Symbol.asyncIterator]();
  const trimStartOfStream = trimStartOfStreamHelper();

  let sourceNodes: NodeWithScore<Metadata>[] | undefined;
  return new ReadableStream<string>({
    start() {
      appendImageData(data, opts?.image_url);
    },
    async pull(controller): Promise<void> {
      const { value, done } = await it.next();
      if (done) {
        appendSourceData(data, sourceNodes);
        controller.close();
        data.close();
        return;
      }

      if (!sourceNodes) {
        // get source nodes from the first response
        sourceNodes = value.sourceNodes;
      }
      const text = trimStartOfStream(value.response ?? "");
      if (text) {
        controller.enqueue(text);
      }
    },
  });
}

export function LlamaIndexStream(
  response: StreamingAgentChatResponse | AsyncIterable<Response>,
  data: StreamData,
  opts?: {
    callbacks?: AIStreamCallbacksAndOptions;
    parserOptions?: ParserOptions;
  },
): { stream: ReadableStream; data: StreamData } {
  const res =
    response instanceof StreamingAgentChatResponse
      ? response.response
      : response;
  return {
    stream: createParser(res, data, opts?.parserOptions)
      .pipeThrough(createCallbacksTransformer(opts?.callbacks))
      .pipeThrough(createStreamDataTransformer()),
    data,
  };
}

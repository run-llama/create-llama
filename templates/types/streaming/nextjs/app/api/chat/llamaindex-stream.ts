import {
  StreamData,
  createCallbacksTransformer,
  createStreamDataTransformer,
  trimStartOfStreamHelper,
  type AIStreamCallbacksAndOptions,
} from "ai";
import {
  BaseNode,
  Metadata,
  Response,
  StreamingAgentChatResponse,
} from "llamaindex";

type ParserOptions = {
  image_url?: string;
};

function appendImageData(data: StreamData, imageUrl?: string) {
  if (!imageUrl) return;
  data.appendMessageAnnotation({
    type: "image",
    data: {
      url: imageUrl,
    },
  });
}

function appendSourceData(
  data: StreamData,
  sourceNodes?: BaseNode<Metadata>[],
) {
  if (!sourceNodes?.length) return;
  data.appendMessageAnnotation({
    type: "sources",
    data: {
      nodes: sourceNodes.map((node) => ({
        ...node.toMutableJSON(),
        id: node.id_,
        score: 1, // FIXME: score is not available now in the source nodes, so we assume it's 1
      })),
    },
  });
}

function createParser(
  res: AsyncIterable<Response>,
  data: StreamData,
  opts?: ParserOptions,
) {
  const it = res[Symbol.asyncIterator]();
  const trimStartOfStream = trimStartOfStreamHelper();

  let sourceNodes: BaseNode<Metadata>[] | undefined;
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
  opts?: {
    callbacks?: AIStreamCallbacksAndOptions;
    parserOptions?: ParserOptions;
  },
): { stream: ReadableStream; data: StreamData } {
  const data = new StreamData();
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

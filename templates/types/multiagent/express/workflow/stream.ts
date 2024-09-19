import { WorkflowEvent } from "@llamaindex/core/workflow";
import {
  StreamData,
  createCallbacksTransformer,
  createStreamDataTransformer,
  trimStartOfStreamHelper,
  type AIStreamCallbacksAndOptions,
} from "ai";
import { AgentRunResult } from ".";

export function LlamaIndexStream(
  it: AsyncGenerator<WorkflowEvent, void>,
  data: StreamData,
  opts?: {
    callbacks?: AIStreamCallbacksAndOptions;
  },
): ReadableStream<Uint8Array> {
  return createParser(it, data)
    .pipeThrough(createCallbacksTransformer(opts?.callbacks))
    .pipeThrough(createStreamDataTransformer());
}

function createParser(
  it: AsyncGenerator<WorkflowEvent, void>,
  data: StreamData,
) {
  const trimStartOfStream = trimStartOfStreamHelper();
  let llmTextResponse = "";

  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(""); // Kickstart the stream
    },
    async pull(controller): Promise<void> {
      const { value, done } = await it.next();
      if (done) return;
      if (value.data instanceof AgentRunResult) {
        const finalResultStream = value.data.response;
        finalResultStream.pipeTo(
          new WritableStream({
            write(chunk) {
              const text = trimStartOfStream(chunk.delta ?? "");
              if (text) {
                llmTextResponse += text;
                controller.enqueue(text);
              }
            },
            close() {
              controller.close();
              data.close();
            },
          }),
        );
      }
    },
  });
}

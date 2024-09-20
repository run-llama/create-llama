import { WorkflowEvent } from "@llamaindex/core/workflow";
import {
  createCallbacksTransformer,
  createStreamDataTransformer,
  StreamData,
  trimStartOfStreamHelper,
  type AIStreamCallbacksAndOptions,
} from "ai";
import { AgentRunResult, FunctionCallingStreamResult } from "./type";

export function toDataStream(
  generator: AsyncGenerator<WorkflowEvent, void>,
  data: StreamData,
  callbacks?: AIStreamCallbacksAndOptions,
) {
  return toReadableStream(generator, data)
    .pipeThrough(createCallbacksTransformer(callbacks))
    .pipeThrough(createStreamDataTransformer());
}

function toReadableStream(
  generator: AsyncGenerator<WorkflowEvent, void>,
  data: StreamData,
) {
  const trimStartOfStream = trimStartOfStreamHelper();
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(""); // Kickstart the stream
    },
    async pull(controller): Promise<void> {
      const { value, done } = await generator.next();
      if (done) return;
      if (value.data instanceof AgentRunResult) {
        const finalResultStream = value.data.response;
        for await (const event of finalResultStream) {
          if (event.data instanceof FunctionCallingStreamResult) {
            const readableStream = event.data.response;
            readableStream.pipeTo(
              new WritableStream({
                write(chunk) {
                  const text = trimStartOfStream(chunk.delta ?? "");
                  if (text) {
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
        }
      }
    },
  });
}

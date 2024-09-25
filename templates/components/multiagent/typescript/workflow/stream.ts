import { WorkflowEvent } from "@llamaindex/core/workflow";
import {
  createCallbacksTransformer,
  createStreamDataTransformer,
  StreamData,
  trimStartOfStreamHelper,
  type AIStreamCallbacksAndOptions,
} from "ai";
import { AgentRunEvent, AgentRunResult } from "./type";

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
      if (done) {
        controller.close();
        data.close();
        return;
      }

      if (value instanceof AgentRunEvent) {
        const { name, msg } = value.data;
        data.appendMessageAnnotation({
          type: "agent",
          data: { agent: name, text: msg },
        });
      }

      if (value instanceof AgentRunResult) {
        const finalResultStream = value.data.response;
        for await (const event of finalResultStream) {
          const text = trimStartOfStream(event.delta ?? "");
          if (text) controller.enqueue(text);
        }
      }
    },
  });
}

import { StopEvent } from "@llamaindex/core/workflow";
import {
  createCallbacksTransformer,
  createStreamDataTransformer,
  StreamData,
  trimStartOfStreamHelper,
  type AIStreamCallbacksAndOptions,
} from "ai";
import { ChatResponseChunk } from "llamaindex";
import { AgentRunEvent } from "./type";

export function toDataStream(
  result: Promise<StopEvent<AsyncGenerator<ChatResponseChunk>>>,
  callbacks?: AIStreamCallbacksAndOptions,
) {
  return toReadableStream(result)
    .pipeThrough(createCallbacksTransformer(callbacks))
    .pipeThrough(createStreamDataTransformer());
}

function toReadableStream(
  result: Promise<StopEvent<AsyncGenerator<ChatResponseChunk>>>,
) {
  const trimStartOfStream = trimStartOfStreamHelper();
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(""); // Kickstart the stream
    },
    async pull(controller): Promise<void> {
      const stopEvent = await result;
      const generator = stopEvent.data.result;
      const { value, done } = await generator.next();
      if (done) {
        controller.close();
        return;
      }

      const text = trimStartOfStream(value.delta ?? "");
      if (text) controller.enqueue(text);
    },
  });
}

export async function workflowEventsToStreamData(
  events: AsyncIterable<AgentRunEvent>,
): Promise<StreamData> {
  const streamData = new StreamData();

  (async () => {
    for await (const event of events) {
      if (event instanceof AgentRunEvent) {
        const { name, msg } = event.data;
        if ((streamData as any).isClosed) {
          break;
        }
        streamData.appendMessageAnnotation({
          type: "agent",
          data: { agent: name, text: msg },
        });
      }
    }
  })();

  return streamData;
}

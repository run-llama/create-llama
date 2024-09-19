import { AgentRunEvent, AgentRunResult } from "@/src/workflow";
import { WorkflowEvent } from "@llamaindex/core/workflow";
import {
  StreamData,
  createCallbacksTransformer,
  createStreamDataTransformer,
  trimStartOfStreamHelper,
  type AIStreamCallbacksAndOptions,
} from "ai";

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
      controller.enqueue("");
    },
    async pull(controller): Promise<void> {
      const { value, done } = await it.next();
      if (done) {
        controller.close();
        data.close();
        return;
      }

      if (value instanceof AgentRunEvent) {
        console.log({ 54: value });
        data.appendMessageAnnotation({
          type: "agent",
          data: {
            agent: value.data.name,
            text: value.data.msg,
          },
        });
      } else if (value instanceof AgentRunResult) {
        console.log({ 63: value });
        llmTextResponse += value.response;
        controller.enqueue(value.response);
      }
    },
  });
}

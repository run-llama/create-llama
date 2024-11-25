import {
  StopEvent,
  WorkflowContext,
  WorkflowEvent,
} from "@llamaindex/workflow";
import { StreamData, createStreamDataTransformer } from "ai";
import { ChatResponseChunk } from "llamaindex";
import { AgentRunEvent } from "./type";

export async function createStreamFromWorkflowContext<Input, Output, Context>(
  context: WorkflowContext<Input, Output, Context>,
): Promise<{ stream: ReadableStream<string>; dataStream: StreamData }> {
  const dataStream = new StreamData();
  const encoder = new TextEncoder();
  let generator: AsyncGenerator<ChatResponseChunk> | undefined;

  const closeStreams = (controller: ReadableStreamDefaultController) => {
    controller.close();
    dataStream.close();
  };

  const mainStream = new ReadableStream({
    async start(controller) {
      // Kickstart the stream by sending an empty string
      controller.enqueue(encoder.encode(""));
    },
    async pull(controller) {
      while (!generator) {
        // get next event from workflow context
        const { value: event, done } =
          await context[Symbol.asyncIterator]().next();
        if (done) {
          closeStreams(controller);
          return;
        }
        generator = handleEvent(event, dataStream);
      }

      const { value: chunk, done } = await generator.next();
      if (done) {
        closeStreams(controller);
        return;
      }
      if (chunk.delta) {
        controller.enqueue(encoder.encode(chunk.delta));
      }
    },
  });

  return {
    stream: mainStream
      .pipeThrough(createStreamDataTransformer())
      .pipeThrough(new TextDecoderStream()),
    dataStream,
  };
}

function handleEvent(
  event: WorkflowEvent<any>,
  dataStream: StreamData,
): AsyncGenerator<ChatResponseChunk> | undefined {
  // Handle for StopEvent
  if (event instanceof StopEvent) {
    return event.data as AsyncGenerator<ChatResponseChunk>;
  }
  // Handle for AgentRunEvent
  if (event instanceof AgentRunEvent) {
    dataStream.appendMessageAnnotation({
      type: "agent",
      data: event.data,
    });
  }
}

import { StopEvent, WorkflowContext } from "@llamaindex/workflow";
import { JSONValue, StreamData } from "ai";
import { AgentStream, ChatResponseChunk, EngineResponse } from "llamaindex";
import { ReadableStream } from "stream/web";

// TODO: Make the event data works with the UI
export async function createStreamFromWorkflowContext<Input, Output, Context>(
  context: WorkflowContext<Input, Output, Context>,
): Promise<{ stream: ReadableStream<EngineResponse>; dataStream: StreamData }> {
  const dataStream = new StreamData();
  let generator: AsyncGenerator<ChatResponseChunk> | undefined;

  const closeStreams = (controller: ReadableStreamDefaultController) => {
    controller.close();
    dataStream.close();
  };

  const stream = new ReadableStream<EngineResponse>({
    async start(controller) {
      // Kickstart the stream by sending an empty string
      controller.enqueue({ delta: "" } as EngineResponse);
    },

    async pull(controller) {
      while (!generator) {
        const { value: event, done } =
          await context[Symbol.asyncIterator]().next();
        if (done) {
          closeStreams(controller);
          return;
        }

        // Stream texts.
        // Two cases:
        // 1. AgentStream event
        // 2. StopEvent with string or generator
        if (event instanceof AgentStream) {
          const { delta } = event.data;
          if (delta) {
            controller.enqueue({ delta } as EngineResponse);
          }
        } else if (event instanceof StopEvent) {
          const { data } = event;
          if (typeof data === "string") {
            controller.enqueue({ delta: data } as EngineResponse);
          } else {
            for await (const chunk of data) {
              controller.enqueue(chunk);
            }
          }
        } else {
          // Stream data from other events
          dataStream.append(event.data as JSONValue);
        }
      }
    },
  });

  return { stream, dataStream };
}

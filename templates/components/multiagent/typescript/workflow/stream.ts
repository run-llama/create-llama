import { StopEvent, WorkflowContext } from "@llamaindex/workflow";
import {
  createStreamDataTransformer,
  StreamData,
  trimStartOfStreamHelper,
} from "ai";
import { ChatResponseChunk, MessageContent } from "llamaindex";
import { AgentRunEvent } from "./type";

export async function createStreamFromWorkflowContext(
  context: WorkflowContext<
    MessageContent,
    ChatResponseChunk,
    unknown | undefined
  >,
): Promise<{ stream: ReadableStream<string>; dataStream: StreamData }> {
  const trimStartOfStream = trimStartOfStreamHelper();
  const dataStream = new StreamData();
  const encoder = new TextEncoder();

  const mainStream = new ReadableStream({
    async start(controller) {
      // Kickstart the stream by sending an empty string
      controller.enqueue(encoder.encode(""));

      for await (const event of context) {
        // Handle for StopEvent
        if (event instanceof StopEvent) {
          const generator = event.data
            .result as AsyncGenerator<ChatResponseChunk>;

          for await (const chunk of generator) {
            const text = trimStartOfStream(chunk.delta ?? "");
            if (text) {
              controller.enqueue(encoder.encode(text));
            }

            // Check if the chunk has a finish flag
            if ((chunk.raw as any)?.choices?.[0]?.finish_reason !== null) {
              // Also close the data stream
              dataStream.close();
              controller.close();
              return;
            }
          }
        }
        // Handle for AgentRunEvent
        if (event instanceof AgentRunEvent) {
          dataStream.appendMessageAnnotation(transformAgentRunEvent(event));
        }
      }
    },
  });

  return {
    stream: mainStream.pipeThrough(createStreamDataTransformer()),
    dataStream,
  };
}

function transformAgentRunEvent(event: AgentRunEvent) {
  return {
    type: "agent",
    data: {
      agent: event.data.name,
      type: event.data.type,
      text: event.data.text,
      ...(event.data.type === "progress" && { data: event.data.data }),
    },
  };
}

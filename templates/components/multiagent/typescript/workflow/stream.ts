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
): Promise<{ stream: ReadableStream<string>; streamData: StreamData }> {
  const trimStartOfStream = trimStartOfStreamHelper();
  const streamData = new StreamData();
  const encoder = new TextEncoder();

  const mainStream = new ReadableStream({
    async start(controller) {
      // Kickstart the stream by sending an empty string
      controller.enqueue(encoder.encode(""));

      for await (const event of context) {
        if (event instanceof StopEvent) {
          const chunkGenerator = event.data
            .result as AsyncGenerator<ChatResponseChunk>;

          for await (const chunk of chunkGenerator) {
            const text = trimStartOfStream(chunk.delta ?? "");
            if (text) {
              controller.enqueue(encoder.encode(text));
            }

            if ((chunk.raw as any)?.choices?.[0]?.finish_reason !== null) {
              streamData.close();
              controller.close();
              return;
            }
          }
        }

        if (event instanceof AgentRunEvent) {
          streamData.appendMessageAnnotation(transformAgentRunEvent(event));
        }
      }
    },
  });

  return {
    stream: mainStream.pipeThrough(createStreamDataTransformer()),
    streamData,
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

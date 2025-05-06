import { agentStreamEvent, type WorkflowEventData } from "@llamaindex/workflow";
// DataStream is deprecated, converting to new API
import {
  createDataStreamResponse,
  formatDataStreamPart,
  type DataStreamWriter,
  type JSONValue,
} from "ai";

/**
 * Convert a stream of WorkflowEventData to a Response object.
 * @param stream - The input stream of WorkflowEventData.
 * @param options - Optional configuration for the response.
 * @returns A Response object with the streamed data.
 */
export function toDataStreamResponse(
  stream: AsyncIterable<WorkflowEventData<unknown>>,
  options: {
    init?: ResponseInit;
    callbacks?: {
      onFinal?: (
        streamWriter: DataStreamWriter,
        content: string,
      ) => Promise<void> | void;
    };
  } = {},
) {
  // TODO: support callbacks (might use pipeDataStreamToResponse)
  const { init, callbacks } = options;

  return createDataStreamResponse({
    execute: async (dataStream) => {
      try {
        let fullContent = "";
        for await (const event of stream) {
          if (agentStreamEvent.include(event) && event.data.delta) {
            const content = event.data.delta;
            if (content) {
              dataStream.write(formatDataStreamPart("text", content));
              fullContent += content;
            }
          } else {
            dataStream.writeMessageAnnotation(event.data as JSONValue);
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";
        dataStream.writeData(errorMessage);
      }
    },
    onError: (error: unknown) => {
      return error instanceof Error
        ? error.message
        : "An unknown error occurred";
    },
  });
}

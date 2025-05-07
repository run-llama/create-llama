import { agentStreamEvent, type WorkflowEventData } from "@llamaindex/workflow";
import {
  createDataStream,
  formatDataStreamPart,
  type DataStreamWriter,
  type JSONValue,
} from "ai";

export interface StreamCallbacks {
  /** `onStart`: Called once when the stream is initialized. */
  onStart?: () => Promise<void> | void;

  /** `onFinal`: Called once when the stream is closed with the final completion message. */
  onFinal?: (completion: string) => Promise<void> | void;

  /** `onText`: Called for each text chunk. */
  onText?: (text: string) => Promise<void> | void;
}

/**
 * Convert a stream of WorkflowEventData to a Response object.
 * @param stream - The input stream of WorkflowEventData.
 * @returns A readable stream of data.
 */
export function toDataStream(
  stream: AsyncIterable<WorkflowEventData<unknown>>,
) {
  return createDataStream({
    execute: async (dataStreamWriter: DataStreamWriter) => {
      for await (const event of stream) {
        if (agentStreamEvent.include(event) && event.data.delta) {
          const content = event.data.delta;
          if (content) {
            dataStreamWriter.write(formatDataStreamPart("text", content));
          }
        } else {
          dataStreamWriter.writeMessageAnnotation(event.data as JSONValue);
        }
      }
    },
    onError: (error: unknown) => {
      return error instanceof Error
        ? error.message
        : "An unknown error occurred during stream finalization";
    },
  });
}

import { agentStreamEvent, type WorkflowEventData } from "@llamaindex/workflow";
import {
  createDataStream,
  formatDataStreamPart,
  type DataStreamWriter,
  type JSONValue,
} from "ai";

/**
 * Configuration options and helper callback methods for stream lifecycle events.
 */
export interface StreamCallbacks {
  /** `onStart`: Called once when the stream is initialized. */
  onStart?: (dataStreamWriter: DataStreamWriter) => Promise<void> | void;

  /** `onFinal`: Called once when the stream is closed with the final completion message. */
  onFinal?: (
    completion: string,
    dataStreamWriter: DataStreamWriter,
  ) => Promise<void> | void;

  /** `onText`: Called for each text chunk. */
  onText?: (
    text: string,
    dataStreamWriter: DataStreamWriter,
  ) => Promise<void> | void;
}

/**
 * Convert a stream of WorkflowEventData to a Response object.
 * @param stream - The input stream of WorkflowEventData.
 * @param options - Optional options for stream lifecycle events.
 * @returns A readable stream of data.
 */
export function toDataStream(
  stream: AsyncIterable<WorkflowEventData<unknown>>,
  options: {
    callbacks?: StreamCallbacks;
  } = {},
) {
  const { callbacks } = options;

  let completionText = "";
  let hasStarted = false;

  return createDataStream({
    execute: async (dataStreamWriter: DataStreamWriter) => {
      if (!hasStarted && callbacks?.onStart) {
        await callbacks.onStart(dataStreamWriter);
        hasStarted = true;
      }

      for await (const event of stream) {
        if (agentStreamEvent.include(event) && event.data.delta) {
          const content = event.data.delta;
          if (content) {
            completionText += content;
            dataStreamWriter.write(formatDataStreamPart("text", content));

            if (callbacks?.onText) {
              await callbacks.onText(content, dataStreamWriter);
            }
          }
        } else {
          dataStreamWriter.writeMessageAnnotation(event.data as JSONValue);
        }
      }

      // Call onFinal with the complete text when stream ends
      if (callbacks?.onFinal) {
        await callbacks.onFinal(completionText, dataStreamWriter);
      }
    },
    onError: (error: unknown) => {
      return error instanceof Error
        ? error.message
        : "An unknown error occurred during stream finalization";
    },
  });
}

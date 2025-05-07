import {
  agentStreamEvent,
  type WorkflowEventData,
  type WorkflowStream,
} from "@llamaindex/workflow";
// DataStream is deprecated, converting to new API
import {
  createDataStream,
  formatDataStreamPart,
  type DataStreamWriter,
  type JSONValue,
} from "ai";

interface StreamCallbacks {
  onStart?: (streamWriter: DataStreamWriter) => Promise<void> | void;
  onCompletion?: (
    streamWriter: DataStreamWriter,
    fullContent: string,
  ) => Promise<void> | void;
  onError?: (
    error: Error,
    streamWriter: DataStreamWriter,
  ) => Promise<void> | void;
}

/**
 * Convert a stream of WorkflowEventData to a Response object.
 * @param stream - The input stream of WorkflowEventData.
 * @param options - Optional configuration for the response.
 * @returns A readable stream of data.
 */
export function toDataStream(
  stream: WorkflowStream<WorkflowEventData<unknown>>,
  options: {
    init?: ResponseInit;
    callbacks?: StreamCallbacks;
  } = {},
) {
  const { init, callbacks: userCallbacks } = options;

  return createDataStream({
    execute: async (dataStream) => {
      await userCallbacks?.onStart?.(dataStream);
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
        await userCallbacks?.onCompletion?.(dataStream, fullContent);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        await userCallbacks?.onError?.(err, dataStream);
        const errorMessage = err.message || "An unknown error occurred";
        dataStream.writeData(errorMessage);
      }
    },
    onError: (error: unknown) => {
      return error instanceof Error
        ? error.message
        : "An unknown error occurred during stream finalization";
    },
    ...(init && { init }),
  });
}

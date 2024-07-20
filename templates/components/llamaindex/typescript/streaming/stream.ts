import {
  StreamData,
  createCallbacksTransformer,
  createStreamDataTransformer,
  trimStartOfStreamHelper,
  type AIStreamCallbacksAndOptions,
} from "ai";
import { ChatMessage, EngineResponse } from "llamaindex";
import { generateNextQuestions } from "../../engine/suggestion";

export function LlamaIndexStream(
  response: AsyncIterable<EngineResponse>,
  data: StreamData,
  chatHistory: ChatMessage[],
  opts?: {
    callbacks?: AIStreamCallbacksAndOptions;
  },
): ReadableStream<Uint8Array> {
  let llmTextResponse = "";
  // Define a custom onComplete callback to get the final result
  const onComplete = (result: string) => {
    llmTextResponse = result;
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // Pipe the initial stream and concatenate the result
      const llmChatStream = createParser(response, data, onComplete)
        .pipeThrough(createCallbacksTransformer(opts?.callbacks))
        .pipeThrough(createStreamDataTransformer());
      const reader = llmChatStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        controller.enqueue(value);
      }

      // When the initial stream is done, start the new stream with concatenatedResult
      chatHistory.push({ role: "assistant", content: llmTextResponse });
      await suggestionStream(chatHistory, controller);
      controller.close();
    },
  });
}

function createParser(
  res: AsyncIterable<EngineResponse>,
  data: StreamData,
  onComplete?: (result: string) => void,
) {
  const it = res[Symbol.asyncIterator]();
  const trimStartOfStream = trimStartOfStreamHelper();

  let responseText = "";
  return new ReadableStream<string>({
    async pull(controller): Promise<void> {
      const { value, done } = await it.next();
      if (done) {
        controller.close();
        data.close();
        onComplete?.(responseText);
        return;
      }
      const text = trimStartOfStream(value.delta ?? "");
      if (text) {
        // Append chunk into the response text.
        responseText += text;
        controller.enqueue(text);
      }
    },
  });
}

async function suggestionStream(
  chatHistory: ChatMessage[],
  controller: ReadableByteStreamController<Uint8Array>,
) {
  const questions: string[] = [];
  await generateNextQuestions(chatHistory, 3, (suggestion?: string[]) => {
    if (suggestion) {
      questions.push(...suggestion);
    }
  });
  if (questions.length > 0) {
    const suggestionDataStream = new StreamData();
    suggestionDataStream.appendMessageAnnotation({
      type: "suggested_questions",
      data: questions,
    });
    const reader = suggestionDataStream.stream.getReader();
    const { value } = await reader.read();
    if (value) {
      controller.enqueue(value);
    }
    suggestionDataStream.close();
  }
}

import {
  StreamData,
  createCallbacksTransformer,
  createStreamDataTransformer,
  trimStartOfStreamHelper,
  type AIStreamCallbacksAndOptions,
} from "ai";
import { ChatMessage, EngineResponse } from "llamaindex";
import { generateNextQuestions } from "./suggestion";

export function LlamaIndexStream(
  response: AsyncIterable<EngineResponse>,
  data: StreamData,
  chatHistory: ChatMessage[],
  opts?: {
    callbacks?: AIStreamCallbacksAndOptions;
  },
): ReadableStream<Uint8Array> {
  return createParser(response, data, chatHistory)
    .pipeThrough(createCallbacksTransformer(opts?.callbacks))
    .pipeThrough(createStreamDataTransformer());
}

function createParser(
  res: AsyncIterable<EngineResponse>,
  data: StreamData,
  chatHistory: ChatMessage[],
) {
  const it = res[Symbol.asyncIterator]();
  const trimStartOfStream = trimStartOfStreamHelper();
  let llmTextResponse = "";

  return new ReadableStream<string>({
    async pull(controller): Promise<void> {
      const { value, done } = await it.next();
      if (done) {
        controller.close();
        // LLM stream is done, generate the next questions with a new LLM call
        chatHistory.push({ role: "assistant", content: llmTextResponse });
        const questions: string[] = await generateNextQuestions(chatHistory);
        if (questions.length > 0) {
          data.appendMessageAnnotation({
            type: "suggested_questions",
            data: questions,
          });
        }
        data.close();
        return;
      }
      const text = trimStartOfStream(value.delta ?? "");
      if (text) {
        llmTextResponse += text;
        controller.enqueue(text);
      }
    },
  });
}

import {
  StreamData,
  createCallbacksTransformer,
  createStreamDataTransformer,
  trimStartOfStreamHelper,
  type AIStreamCallbacksAndOptions,
} from "ai";
import { ChatMessage, EngineResponse } from "llamaindex";
import { generateNextQuestions } from "../../engine/suggestion";

/**
 * Trims the response in Vercel's format to get the actual response
 */
const trimVercelResponse = (text: string) => {
  return text.replace(/0:"/g, "").replace(/"$/g, "");
};

export function LlamaIndexStream(
  response: AsyncIterable<EngineResponse>,
  data: StreamData,
  chatHistory: ChatMessage[],
  opts?: {
    callbacks?: AIStreamCallbacksAndOptions;
  },
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // Pipe the initial stream and concatenate the result
      const llmChatStream = createParser(response)
        .pipeThrough(createCallbacksTransformer(opts?.callbacks))
        .pipeThrough(createStreamDataTransformer());
      const reader = llmChatStream.getReader();
      let llmTextResponse = "";
      while (true) {
        const { done, value } = await reader.read();
        const rawTextChunk = new TextDecoder().decode(value).trim();
        if (rawTextChunk && rawTextChunk.startsWith('0:"')) {
          llmTextResponse += trimVercelResponse(rawTextChunk);
        }
        if (done) {
          chatHistory.push({ role: "assistant", content: llmTextResponse });
          const questions: string[] = await generateNextQuestions(chatHistory);
          if (questions.length > 0) {
            data.appendMessageAnnotation({
              type: "suggested_questions",
              data: questions,
            });
          }
          break;
        }
        controller.enqueue(value);
      }
      controller.close();
      data.close();
    },
  });
}

function createParser(res: AsyncIterable<EngineResponse>) {
  const it = res[Symbol.asyncIterator]();
  const trimStartOfStream = trimStartOfStreamHelper();

  return new ReadableStream<string>({
    async pull(controller): Promise<void> {
      const { value, done } = await it.next();
      if (done) {
        controller.close();
        return;
      }
      const text = trimStartOfStream(value.delta ?? "");
      if (text) {
        controller.enqueue(text);
      }
    },
  });
}

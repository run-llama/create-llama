import { ContextChatEngine, Settings } from "llamaindex";
import { getDataSource } from "./index";
import { nodeCitationProcessor } from "./nodePostprocessors";
import { generateFilters } from "./queryFilter";

export async function createChatEngine(documentIds?: string[], params?: any) {
  const index = await getDataSource(params);
  if (!index) {
    throw new Error(
      `StorageContext is empty - call 'npm run generate' to generate the storage first`,
    );
  }
  const retriever = index.asRetriever({
    similarityTopK: process.env.TOP_K ? parseInt(process.env.TOP_K) : undefined,
    filters: generateFilters(documentIds || []),
  });

  const systemPrompt = process.env.SYSTEM_PROMPT;
  const citationPrompt = process.env.SYSTEM_CITATION_PROMPT;
  const prompt =
    [systemPrompt, citationPrompt].filter((p) => p).join("\n") || undefined;
  const nodePostprocessors = citationPrompt
    ? [nodeCitationProcessor]
    : undefined;

  return new ContextChatEngine({
    chatModel: Settings.llm,
    retriever,
    systemPrompt: prompt,
    nodePostprocessors,
  });
}

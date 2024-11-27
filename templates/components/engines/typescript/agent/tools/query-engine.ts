import {
  BaseQueryEngine,
  LlamaCloudIndex,
  QueryEngineTool,
  VectorStoreIndex,
} from "llamaindex";
import { generateFilters } from "../queryFilter";

interface QueryEngineParams {
  documentIds?: string[];
  topK?: number;
}

export function createQueryEngineTool(
  index: VectorStoreIndex | LlamaCloudIndex,
  params?: QueryEngineParams,
  name?: string,
  description?: string,
): QueryEngineTool {
  return new QueryEngineTool({
    queryEngine: createQueryEngine(index, params),
    metadata: {
      name: name || "query_engine",
      description:
        description ||
        `Use this tool to retrieve information about the text corpus from an index.`,
    },
  });
}

function createQueryEngine(
  index: VectorStoreIndex | LlamaCloudIndex,
  params?: QueryEngineParams,
): BaseQueryEngine {
  const baseQueryParams = {
    similarityTopK:
      params?.topK ??
      (process.env.TOP_K ? parseInt(process.env.TOP_K) : undefined),
    preFilters: generateFilters(params?.documentIds || []),
  };

  if (index instanceof LlamaCloudIndex) {
    return index.asQueryEngine({
      ...baseQueryParams,
      retrieval_mode: "auto_routed",
    });
  }
  return index.asQueryEngine(baseQueryParams);
}

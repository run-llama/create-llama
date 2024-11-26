import {
  BaseQueryEngine,
  LlamaCloudIndex,
  QueryEngineTool,
  VectorStoreIndex,
} from "llamaindex";

export function createQueryEngineTool(
  index: VectorStoreIndex | LlamaCloudIndex,
  params?: any,
  metadata?: any,
): QueryEngineTool {
  return new QueryEngineTool({
    queryEngine: createQueryEngine(index, params),
    metadata: {
      name: "query_engine",
      description: `Use this tool to retrieve information about the text corpus from an index.`,
      ...metadata,
    },
  });
}

function createQueryEngine(
  index: VectorStoreIndex | LlamaCloudIndex,
  params: any = {},
): BaseQueryEngine {
  const queryParams = {
    ...params,
    similarityTopK: process.env.TOP_K ? parseInt(process.env.TOP_K) : undefined,
  };

  if (index instanceof LlamaCloudIndex) {
    queryParams.retriever_mode = "auto_routed";
  }

  return index.asQueryEngine(queryParams);
}

import {
  BaseToolWithCall,
  MetadataFilters,
  OpenAIAgent,
  QueryEngineTool,
  VectorStoreByType,
} from "llamaindex";
import { SimpleVectorStore } from "llamaindex/storage/vectorStore/SimpleVectorStore";
import fs from "node:fs/promises";
import path from "node:path";
import { getDataSource } from "./index";
import { createTools } from "./tools";

export async function createChatEngine(documentIds?: string[]) {
  const tools: BaseToolWithCall[] = [];

  // Add a query engine tool if we have a data source
  // Delete this code if you don't have a data source
  const index = await getDataSource();
  if (index) {
    tools.push(
      new QueryEngineTool({
        queryEngine: index.asQueryEngine({
          preFilters: getQueryFilters(index.vectorStores, documentIds),
        }),
        metadata: {
          name: "data_query_engine",
          description: `A query engine for documents from your data source.`,
        },
      }),
    );
  }

  const configFile = path.join("config", "tools.json");
  let toolConfig: any;
  try {
    // add tools from config file if it exists
    toolConfig = JSON.parse(await fs.readFile(configFile, "utf8"));
  } catch (e) {
    console.info(`Could not read ${configFile} file. Using no tools.`);
  }
  if (toolConfig) {
    tools.push(...(await createTools(toolConfig)));
  }

  return new OpenAIAgent({
    tools,
    systemPrompt: process.env.SYSTEM_PROMPT,
  });
}

function getQueryFilters(
  vectorStores: VectorStoreByType,
  documentIds?: string[],
): MetadataFilters | undefined {
  // SimpleVectorStore doesn't support metadata filters,
  // Don't apply filters if any of the vector stores is a SimpleVectorStore
  if (
    Object.values(vectorStores).some(
      (store) => store instanceof SimpleVectorStore,
    )
  ) {
    return undefined;
  }

  if (documentIds?.length) {
    return {
      filters: [
        {
          key: "private",
          value: "true",
          filterType: "ExactMatch",
        },
        // TODO(thucpn): Add ContainMatch to LITS and replace below
        {
          key: "doc_id",
          value: documentIds[0],
          filterType: "ExactMatch",
        },
      ],
    };
  }
  return {
    filters: [
      {
        key: "private",
        value: "true",
        filterType: "ExactMatch",
      },
    ],
  };
}

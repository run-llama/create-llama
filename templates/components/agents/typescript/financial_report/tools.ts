import fs from "fs/promises";
import { BaseToolWithCall, LlamaCloudIndex, QueryEngineTool } from "llamaindex";
import path from "path";
import { getDataSource } from "../engine";
import { createTools } from "../engine/tools/index";

export const getQueryEngineTools = async (
  params?: any,
): Promise<QueryEngineTool[] | null> => {
  const topK = process.env.TOP_K ? parseInt(process.env.TOP_K) : undefined;

  const index = await getDataSource(params);
  if (!index) {
    return null;
  }
  // index is LlamaCloudIndex use two query engine tools
  if (index instanceof LlamaCloudIndex) {
    return [
      new QueryEngineTool({
        queryEngine: index.asQueryEngine({
          similarityTopK: topK,
          retrieval_mode: "files_via_content",
        }),
        metadata: {
          name: "document_retriever",
          description: `Document retriever that retrieves entire documents from the corpus.
  ONLY use for research questions that may require searching over entire research reports.
  Will be slower and more expensive than chunk-level retrieval but may be necessary.`,
        },
      }),
      new QueryEngineTool({
        queryEngine: index.asQueryEngine({
          similarityTopK: topK,
          retrieval_mode: "chunks",
        }),
        metadata: {
          name: "chunk_retriever",
          description: `Retrieves a small set of relevant document chunks from the corpus.
      Use for research questions that want to look up specific facts from the knowledge corpus,
      and need entire documents.`,
        },
      }),
    ];
  } else {
    return [
      new QueryEngineTool({
        queryEngine: (index as any).asQueryEngine({
          similarityTopK: topK,
        }),
        metadata: {
          name: "retriever",
          description: `Use this tool to retrieve information about the text corpus from the index.`,
        },
      }),
    ];
  }
};

export const getAvailableTools = async () => {
  const configFile = path.join("config", "tools.json");
  let toolConfig: any;
  const tools: BaseToolWithCall[] = [];
  try {
    toolConfig = JSON.parse(await fs.readFile(configFile, "utf8"));
  } catch (e) {
    console.info(`Could not read ${configFile} file. Using no tools.`);
  }
  if (toolConfig) {
    tools.push(...(await createTools(toolConfig)));
  }
  const queryEngineTools = await getQueryEngineTools();
  if (queryEngineTools) {
    tools.push(...queryEngineTools);
  }

  return tools;
};

export const lookupTools = async (
  toolNames: string[],
): Promise<BaseToolWithCall[]> => {
  const availableTools = await getAvailableTools();
  return availableTools.filter((tool) =>
    toolNames.includes(tool.metadata.name),
  );
};

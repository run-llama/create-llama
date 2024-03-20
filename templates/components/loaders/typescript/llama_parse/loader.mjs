import {
  FILE_EXT_TO_READER,
  LlamaParseReader,
  SimpleDirectoryReader,
} from "llamaindex";

export const DATA_DIR = "./data";

export async function getDocuments() {
  const reader = new SimpleDirectoryReader();
  // Load PDFs using LlamaParseReader
  return await reader.loadData({
    directoryPath: DATA_DIR,
    fileExtToReader: {
      ...FILE_EXT_TO_READER,
      pdf: new LlamaParseReader({ resultType: "markdown" }),
    },
  });
}

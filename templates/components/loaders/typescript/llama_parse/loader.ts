import { LlamaParseReader } from "llamaindex/readers/LlamaParseReader";
import {
  FILE_EXT_TO_READER,
  SimpleDirectoryReader,
} from "llamaindex/readers/SimpleDirectoryReader";

export const DATA_DIR = "./data";

export function getExtractors() {
  const llamaParseParser = new LlamaParseReader({ resultType: "markdown" });
  const extractors = FILE_EXT_TO_READER;
  // Change all the supported extractors to LlamaParse
  // except for .txt, it doesn't need to be parsed
  for (const key in extractors) {
    if (key === "txt") {
      continue;
    }
    extractors[key] = llamaParseParser;
  }
  return extractors;
}

export async function getDocuments() {
  const reader = new SimpleDirectoryReader();
  const extractors = getExtractors();
  return await reader.loadData({
    directoryPath: DATA_DIR,
    fileExtToReader: extractors,
  });
}

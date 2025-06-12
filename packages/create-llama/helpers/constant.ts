import { TemplateUseCase } from "./types";

export const COMMUNITY_OWNER = "run-llama";
export const COMMUNITY_REPO = "create_llama_projects";
export const LLAMA_PACK_OWNER = "run-llama";
export const LLAMA_PACK_REPO = "llama_index";
export const LLAMA_PACK_FOLDER = "llama-index-packs";
export const LLAMA_PACK_FOLDER_PATH = `${LLAMA_PACK_OWNER}/${LLAMA_PACK_REPO}/main/${LLAMA_PACK_FOLDER}`;

// these use cases don't have data folder, so no need to run generate and no need to getIndex
export const NO_DATA_USE_CASES: TemplateUseCase[] = [
  "code_generator",
  "document_generator",
  "hitl",
];

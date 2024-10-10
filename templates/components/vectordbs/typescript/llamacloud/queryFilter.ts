import { CloudRetrieveParams, MetadataFilter } from "llamaindex";

export function generateFilters(documentIds: string[]) {
  // public documents (ingested by "npm run generate" or in the LlamaCloud UI) don't have the "private" field
  const publicDocumentsFilter: MetadataFilter = {
    key: "private",
    operator: "is_empty",
  };

  // if no documentIds are provided, only retrieve information from public documents
  if (!documentIds.length)
    return {
      filters: [publicDocumentsFilter],
    } as CloudRetrieveParams["filters"];

  const privateDocumentsFilter: MetadataFilter = {
    key: "file_id", // Note: LLamaCloud uses "file_id" to reference private document ids as "doc_id" is a restricted field in LlamaCloud
    value: documentIds,
    operator: "in",
  };

  // if documentIds are provided, retrieve information from public and private documents
  return {
    filters: [publicDocumentsFilter, privateDocumentsFilter],
    condition: "or",
  } as CloudRetrieveParams["filters"];
}

import type { MetadataFilter, MetadataFilters } from "@llamaindex/cloud/api";

export function generateFilters(documentIds: string[]): MetadataFilters {
  // public documents don't have the "private" field or it's set to "false"
  // @ts-ignore TODO: fix typing in @llamaindex/cloud/api
  const publicDocumentsFilter: MetadataFilter = {
    key: "private",
    operator: "is_empty",
  };

  // if no documentIds are provided, only retrieve information from public documents
  if (!documentIds.length) return { filters: [publicDocumentsFilter] };

  const privateDocumentsFilter: MetadataFilter = {
    key: "file_id", // Note: LLamaCloud uses "file_id" to reference private document ids as "doc_id" is a restricted field in LlamaCloud
    value: documentIds,
    operator: "in",
  };

  // if documentIds are provided, retrieve information from public and private documents
  return {
    filters: [publicDocumentsFilter, privateDocumentsFilter],
    condition: "or",
  };
}

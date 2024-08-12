import { MetadataFilter, MetadataFilters } from "llamaindex";

export function generateFilters(documentIds: string[]): MetadataFilters {
  // public documents don't have the "private" field or it's set to "false"
  const publicDocumentsFilter: MetadataFilter = {
    key: "private",
    value: ["true"],
    operator: "nin",
  };

  // if no documentIds are provided, only retrieve information from public documents
  if (!documentIds.length) return { filters: [publicDocumentsFilter] };

  const privateDocumentsFilter: MetadataFilter = {
    key: "doc_id",
    value: documentIds,
    operator: "in",
  };

  // if documentIds are provided, retrieve information from public and private documents
  return {
    filters: [publicDocumentsFilter, privateDocumentsFilter],
    condition: "or",
  };
}

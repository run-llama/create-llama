/* eslint-disable turbo/no-undeclared-env-vars */
import {
  LLM,
  PGVectorStore,
  VectorStoreIndex,
  serviceContextFromDefaults,
} from "llamaindex";
import {
  CHUNK_OVERLAP,
  CHUNK_SIZE,
  PGVECTOR_SCHEMA,
  PGVECTOR_TABLE,
  checkRequiredEnvVars,
} from "./shared";

export async function getDataSource(llm: LLM) {
  checkRequiredEnvVars();
  const pgvs = new PGVectorStore({
    connectionString: process.env.PG_CONNECTION_STRING,
    schemaName: PGVECTOR_SCHEMA,
    tableName: PGVECTOR_TABLE,
  });
  const serviceContext = serviceContextFromDefaults({
    llm,
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  return await VectorStoreIndex.fromVectorStore(pgvs, serviceContext);
}

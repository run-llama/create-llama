/* eslint-disable turbo/no-undeclared-env-vars */
import { VectorStoreIndex } from "llamaindex";
import { PGVectorStore } from "llamaindex/storage/vectorStore/PGVectorStore";
import {
  PGVECTOR_SCHEMA,
  PGVECTOR_TABLE,
  checkRequiredEnvVars,
} from "./shared";

export async function getDataSource() {
  checkRequiredEnvVars();
  const pgvs = new PGVectorStore({
    connectionString: process.env.PG_CONNECTION_STRING,
    schemaName: PGVECTOR_SCHEMA,
    tableName: PGVECTOR_TABLE,
  });
  return await VectorStoreIndex.fromVectorStore(pgvs);
}

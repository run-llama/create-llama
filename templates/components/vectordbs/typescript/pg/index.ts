/* eslint-disable turbo/no-undeclared-env-vars */
import { PGVectorStore, VectorStoreIndex } from "llamaindex";
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

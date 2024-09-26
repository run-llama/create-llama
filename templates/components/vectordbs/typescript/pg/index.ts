import { VectorStoreIndex } from "llamaindex";
import { PGVectorStore } from "llamaindex/vector-store/PGVectorStore";
import {
  PGVECTOR_SCHEMA,
  PGVECTOR_TABLE,
  checkRequiredEnvVars,
} from "./shared";

export async function getDataSource(params?: any) {
  checkRequiredEnvVars();
  const pgvs = new PGVectorStore({
    connectionString: process.env.PG_CONNECTION_STRING,
    schemaName: PGVECTOR_SCHEMA,
    tableName: PGVECTOR_TABLE,
  });
  return await VectorStoreIndex.fromVectorStore(pgvs);
}

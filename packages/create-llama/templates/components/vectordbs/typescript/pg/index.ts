import { PGVectorStore } from "@llamaindex/postgres";
import { VectorStoreIndex } from "llamaindex";
import {
  PGVECTOR_SCHEMA,
  PGVECTOR_TABLE,
  checkRequiredEnvVars,
} from "./shared";

export async function getDataSource(params?: any) {
  checkRequiredEnvVars();
  const pgvs = new PGVectorStore({
    clientConfig: {
      connectionString: process.env.PG_CONNECTION_STRING,
    },
    schemaName: PGVECTOR_SCHEMA,
    tableName: PGVECTOR_TABLE,
    dimensions: process.env.EMBEDDING_DIM
      ? parseInt(process.env.EMBEDDING_DIM)
      : undefined,
  });
  return await VectorStoreIndex.fromVectorStore(pgvs);
}

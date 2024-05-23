import os
from llama_index.vector_stores.postgres import PGVectorStore
from urllib.parse import urlparse

PGVECTOR_SCHEMA = "public"
PGVECTOR_TABLE = "llamaindex_embedding"

vector_store: PGVectorStore = None


def get_vector_store():
    global vector_store

    if vector_store is None:
        original_conn_string = os.environ.get("PG_CONNECTION_STRING")
        if original_conn_string is None or original_conn_string == "":
            raise ValueError("PG_CONNECTION_STRING environment variable is not set.")

        # The PGVectorStore requires both two connection strings, one for psycopg2 and one for asyncpg
        # Update the configured scheme with the psycopg2 and asyncpg schemes
        original_scheme = urlparse(original_conn_string).scheme + "://"
        conn_string = original_conn_string.replace(
            original_scheme, "postgresql+psycopg2://"
        )
        async_conn_string = original_conn_string.replace(
            original_scheme, "postgresql+asyncpg://"
        )

        vector_store = PGVectorStore(
            connection_string=conn_string,
            async_connection_string=async_conn_string,
            schema_name=PGVECTOR_SCHEMA,
            table_name=PGVECTOR_TABLE,
            embed_dim=int(os.environ.get("EMBEDDING_DIM", 1024)),
        )

    return vector_store

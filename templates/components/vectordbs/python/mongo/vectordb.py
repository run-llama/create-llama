import os
from llama_index.vector_stores.mongodb import MongoDBAtlasVectorSearch


def get_vector_store():
    store = MongoDBAtlasVectorSearch(
        db_name=os.environ["MONGODB_DATABASE"],
        collection_name=os.environ["MONGODB_VECTORS"],
        index_name=os.environ["MONGODB_VECTOR_INDEX"],
    )
    return store

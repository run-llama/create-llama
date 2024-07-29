from dotenv import load_dotenv

load_dotenv()

import os
import logging
from app.settings import init_settings
from app.engine.loaders import get_documents
from llama_index.indices.managed.llama_cloud import LlamaCloudIndex


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_datasource():
    init_settings()
    logger.info("Generate index for the provided data")

    name = os.getenv("LLAMA_CLOUD_INDEX_NAME")
    project_name = os.getenv("LLAMA_CLOUD_PROJECT_NAME")
    api_key = os.getenv("LLAMA_CLOUD_API_KEY")
    base_url = os.getenv("LLAMA_CLOUD_BASE_URL")
    organization_id = os.getenv("LLAMA_CLOUD_ORGANIZATION_ID")

    if name is None or project_name is None or api_key is None:
        raise ValueError(
            "Please set LLAMA_CLOUD_INDEX_NAME, LLAMA_CLOUD_PROJECT_NAME and LLAMA_CLOUD_API_KEY"
            " to your environment variables or config them in .env file"
        )

    documents = get_documents()

    # Set private=false to mark the document as public (required for filtering)
    for doc in documents:
        doc.metadata["private"] = "false"

    LlamaCloudIndex.from_documents(
        documents=documents,
        name=name,
        project_name=project_name,
        api_key=api_key,
        base_url=base_url,
        organization_id=organization_id
    )

    logger.info("Finished generating the index")


if __name__ == "__main__":
    generate_datasource()

# flake8: noqa: E402
import os

from dotenv import load_dotenv

load_dotenv()

import logging

from app.engine.index import get_client, get_index
from app.engine.service import LLamaCloudFileService
from app.settings import init_settings
from llama_cloud import PipelineType
from llama_index.core.readers import SimpleDirectoryReader
from llama_index.core.settings import Settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def ensure_index(index):
    project_id = index._get_project_id()
    client = get_client()
    pipelines = client.pipelines.search_pipelines(
        project_id=project_id,
        pipeline_name=index.name,
        pipeline_type=PipelineType.MANAGED.value,
    )
    if len(pipelines) == 0:
        from llama_index.embeddings.openai import OpenAIEmbedding

        if not isinstance(Settings.embed_model, OpenAIEmbedding):
            raise ValueError(
                "Creating a new pipeline with a non-OpenAI embedding model is not supported."
            )
        client.pipelines.upsert_pipeline(
            project_id=project_id,
            request={
                "name": index.name,
                "embedding_config": {
                    "type": "OPENAI_EMBEDDING",
                    "component": {
                        "api_key": os.getenv("OPENAI_API_KEY"),  # editable
                        "model_name": os.getenv("EMBEDDING_MODEL"),
                    },
                },
                "transform_config": {
                    "mode": "auto",
                    "config": {
                        "chunk_size": Settings.chunk_size,  # editable
                        "chunk_overlap": Settings.chunk_overlap,  # editable
                    },
                },
            },
        )


def generate_datasource():
    init_settings()
    logger.info("Generate index for the provided data")

    index = get_index()
    ensure_index(index)
    project_id = index._get_project_id()
    pipeline_id = index._get_pipeline_id()

    # use SimpleDirectoryReader to retrieve the files to process
    reader = SimpleDirectoryReader(
        "data",
        recursive=True,
    )
    files_to_process = reader.input_files

    # add each file to the LlamaCloud pipeline
    for input_file in files_to_process:
        with open(input_file, "rb") as f:
            logger.info(
                f"Adding file {input_file} to pipeline {index.name} in project {index.project_name}"
            )
            LLamaCloudFileService.add_file_to_pipeline(
                project_id, pipeline_id, f, custom_metadata={}
            )

    logger.info("Finished generating the index")


if __name__ == "__main__":
    generate_datasource()

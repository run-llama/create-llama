# flake8: noqa: E402
from dotenv import load_dotenv

from app.engine.index import get_index

load_dotenv()

import logging
from llama_index.core.readers import SimpleDirectoryReader
from app.engine.service import LLamaCloudFileService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_datasource():
    logger.info("Generate index for the provided data")

    index = get_index()
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
                project_id,
                pipeline_id,
                f,
                custom_metadata={
                    # Set private=false to mark the document as public (required for filtering)
                    "private": "false",
                },
            )

    logger.info("Finished generating the index")


if __name__ == "__main__":
    generate_datasource()

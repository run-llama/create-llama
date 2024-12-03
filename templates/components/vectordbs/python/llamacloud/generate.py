# flake8: noqa: E402

from dotenv import load_dotenv

load_dotenv()

import logging

from llama_index.core.readers import SimpleDirectoryReader

from app.engine.index import get_index
from app.engine.service import LLamaCloudFileService  # type: ignore
from app.settings import init_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_datasource():
    init_settings()
    logger.info("Generate index for the provided data")

    index = get_index(create_if_missing=True)
    if index is None:
        raise ValueError("Index not found and could not be created")

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
                index.project.id,
                index.pipeline.id,
                f,
                custom_metadata={},
                wait_for_processing=False,
            )

    logger.info("Finished generating the index")


if __name__ == "__main__":
    generate_datasource()

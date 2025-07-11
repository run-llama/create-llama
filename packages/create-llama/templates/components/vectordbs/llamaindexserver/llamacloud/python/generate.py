# flake8: noqa: E402

from dotenv import load_dotenv

load_dotenv()

import logging

from llama_index.core.readers import SimpleDirectoryReader
from tqdm import tqdm

from src.index import get_index
from src.service import LLamaCloudFileService
from src.settings import init_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_index():
    init_settings()
    logger.info("Generate index for the provided data")

    index = get_index(create_if_missing=True)
    if index is None:
        raise ValueError("Index not found and could not be created")

    # use SimpleDirectoryReader to retrieve the files to process
    reader = SimpleDirectoryReader(
        "ui/data",
        recursive=True,
    )
    files_to_process = reader.input_files

    # add each file to the LlamaCloud pipeline
    error_files = []
    for input_file in tqdm(
        files_to_process,
        desc="Processing files",
        unit="file",
    ):
        with open(input_file, "rb") as f:
            logger.debug(
                f"Adding file {input_file} to pipeline {index.name} in project {index.project_name}"
            )
            try:
                LLamaCloudFileService.add_file_to_pipeline(
                    index.project.id,
                    index.pipeline.id,
                    f,
                    custom_metadata={},
                    wait_for_processing=False,
                )
            except Exception as e:
                error_files.append(input_file)
                logger.error(f"Error adding file {input_file}: {e}")

    if error_files:
        logger.error(f"Failed to add the following files: {error_files}")

    logger.info("Finished generating the index")


if __name__ == "__main__":
    generate_index()

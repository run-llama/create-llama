import logging
from typing import Optional

from tqdm import tqdm

from llama_index.core.readers import SimpleDirectoryReader
from llama_index.indices.managed.llama_cloud import LlamaCloudIndex
from llama_index.server.services.llamacloud.file import LlamaCloudFileService


def load_to_llamacloud(
    index: LlamaCloudIndex,
    data_dir: Optional[str] = None,
    recursive: Optional[bool] = None,
    logger: Optional[logging.Logger] = None,
) -> None:
    if logger is None:
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger()

    logger.info("Generate index for the provided data")

    # use SimpleDirectoryReader to retrieve the files to process
    reader = SimpleDirectoryReader(
        data_dir or "data",
        recursive=recursive or True,
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
                LlamaCloudFileService.add_file_to_pipeline(
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

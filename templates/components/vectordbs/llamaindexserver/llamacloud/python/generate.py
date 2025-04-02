# flake8: noqa: E402

from dotenv import load_dotenv

load_dotenv()

import logging

from app.index import get_index
from app.settings import init_settings
from llama_index.server.services.llamacloud.generate import (
    load_to_llamacloud,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_datasource():
    init_settings()
    logger.info("Generate index for the provided data")

    index = get_index(create_if_missing=True)
    if index is None:
        raise ValueError("Index not found and could not be created")

    load_to_llamacloud(index, logger=logger)


if __name__ == "__main__":
    generate_datasource()

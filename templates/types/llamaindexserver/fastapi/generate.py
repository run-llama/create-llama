import logging
import os
import sys

from dotenv import load_dotenv
from llama_index.llms.openai import OpenAI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_index():
    """
    Index the documents in the data directory.
    """
    from app.index import STORAGE_DIR
    from app.settings import init_settings
    from llama_index.core.indices import (
        VectorStoreIndex,
    )
    from llama_index.core.readers import SimpleDirectoryReader

    load_dotenv()
    init_settings()

    logger.info("Creating new index")
    # load the documents and create the index
    reader = SimpleDirectoryReader(
        os.environ.get("DATA_DIR", "data"),
        recursive=True,
    )
    documents = reader.load_data()
    index = VectorStoreIndex.from_documents(
        documents,
        show_progress=True,
    )
    # store it for later
    index.storage_context.persist(STORAGE_DIR)
    logger.info(f"Finished creating new index. Stored in {STORAGE_DIR}")


def generate_ui_for_workflow():
    """
    Generate UI component for events from workflow.
    Takes --input_file and --output_file as command line arguments.
    """
    import asyncio

    from llama_index.server.gen_ui.main import generate_ui_for_workflow

    # Parse command line arguments
    args = sys.argv[1:]
    input_file = None
    output_file = None

    for i in range(0, len(args), 2):
        if args[i] == "--input_file":
            input_file = args[i + 1]
        elif args[i] == "--output_file":
            output_file = args[i + 1]

    if not input_file or not output_file:
        print("Error: Both --input_file and --output_file arguments are required")
        sys.exit(1)

    llm = OpenAI(model="gpt-4.1")
    code = asyncio.run(generate_ui_for_workflow(input_file, llm=llm))
    with open(output_file, "w") as f:
        f.write(code)

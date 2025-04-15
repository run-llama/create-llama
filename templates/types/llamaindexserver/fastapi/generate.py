import logging
import os

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
    Generate UI for UIEventData event in app/workflow.py
    """
    import asyncio

    # To generate UI components for additional event types,
    # import the corresponding data model (e.g., MyCustomEventData)
    # and run the generate_ui_for_workflow function with the imported model.
    # You may also want to adjust the output filename for the generated UI component that matches the event type.
    try:
        from app.workflow import UIEventData
    except ImportError:
        raise ImportError("Couldn't generate UI component for the current workflow.")
    from llama_index.server.gen_ui.main import generate_ui_for_workflow

    llm = OpenAI(model="gpt-4.1")
    code = asyncio.run(generate_ui_for_workflow(event_cls=UIEventData, llm=llm))
    with open("components/ui_event.jsx", "w") as f:
        f.write(code)

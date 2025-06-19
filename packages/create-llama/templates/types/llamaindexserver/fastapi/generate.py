import logging
import os

from dotenv import load_dotenv

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

    from app.settings import init_settings
    from llama_index.core.settings import Settings
    from main import COMPONENT_DIR

    load_dotenv()
    init_settings()

    # To generate UI components for additional event types,
    # import the corresponding data model (e.g., MyCustomEventData)
    # and run the generate_ui_for_workflow function with the imported model.
    # Make sure the output filename of the generated UI component matches the event type (here `ui_event`)
    try:
        from app.workflow import UIEventData  # type: ignore
    except ImportError:
        raise ImportError("Couldn't generate UI component for the current workflow.")
    from llama_index.server.gen_ui import generate_event_component

    # works well with OpenAI gpt-4.1, Claude 3.7 Sonnet or Gemini Pro 2.5
    code = asyncio.run(
        generate_event_component(event_cls=UIEventData, llm=Settings.llm)
    )
    with open(f"{COMPONENT_DIR}/ui_event.jsx", "w") as f:
        f.write(code)

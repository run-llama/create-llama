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


def generate_index():
    init_settings()
    logger.info("Generate index for the provided data")

    index = get_index(create_if_missing=True)
    if index is None:
        raise ValueError("Index not found and could not be created")

    load_to_llamacloud(index, logger=logger)


def generate_ui_for_workflow():
    """
    Generate UI for UIEventData event in app/workflow.py
    """
    import asyncio
    from llama_index.llms.openai import OpenAI
    from main import COMPONENT_DIR

    # To generate UI components for additional event types,
    # import the corresponding data model (e.g., MyCustomEventData)
    # and run the generate_ui_for_workflow function with the imported model.
    # Make sure the output filename of the generated UI component matches the event type (here `ui_event`)
    try:
        from app.workflow import UIEventData  # type: ignore
    except ImportError:
        raise ImportError("Couldn't generate UI component for the current workflow.")
    from llama_index.server.gen_ui import generate_event_component

    # works also well with Claude 3.7 Sonnet or Gemini Pro 2.5
    llm = OpenAI(model="gpt-4.1")
    code = asyncio.run(generate_event_component(event_cls=UIEventData, llm=llm))
    with open(f"{COMPONENT_DIR}/ui_event.jsx", "w") as f:
        f.write(code)

import logging
from typing import List, Optional
from app.examples.choreography import create_choreography
from app.examples.orchestrator import create_orchestrator
from app.examples.workflow import create_workflow


from llama_index.core.workflow import Workflow
from llama_index.core.chat_engine.types import ChatMessage


import os

logger = logging.getLogger("uvicorn")


def create_agent(chat_history: Optional[List[ChatMessage]] = None) -> Workflow:
    agent_type = os.getenv("EXAMPLE_TYPE", "").lower()
    match agent_type:
        case "choreography":
            agent = create_choreography(chat_history)
        case "orchestrator":
            agent = create_orchestrator(chat_history)
        case _:
            agent = create_workflow(chat_history)

    logger.info(f"Using agent pattern: {agent_type}")

    return agent

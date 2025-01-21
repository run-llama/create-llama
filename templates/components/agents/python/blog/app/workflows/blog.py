import logging
import os
from typing import List, Optional

from app.agents.choreography import create_choreography
from app.agents.orchestrator import create_orchestrator
from app.agents.workflow import create_workflow as create_blog_workflow
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.workflow import Workflow

logger = logging.getLogger("uvicorn")


def create_workflow(
    chat_history: Optional[List[ChatMessage]] = None, **kwargs
) -> Workflow:
    # Chat filters are not supported yet
    kwargs.pop("filters", None)
    agent_type = os.getenv("EXAMPLE_TYPE", "").lower()
    match agent_type:
        case "choreography":
            agent = create_choreography(chat_history, **kwargs)
        case "orchestrator":
            agent = create_orchestrator(chat_history, **kwargs)
        case _:
            agent = create_blog_workflow(chat_history, **kwargs)

    logger.info(f"Using agent pattern: {agent_type}")

    return agent

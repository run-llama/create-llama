import logging
import os
from typing import List, Optional

from app.financial_report.choreography import create_choreography
from app.financial_report.orchestrator import create_orchestrator
from app.financial_report.workflow import create_workflow
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.workflow import Workflow

logger = logging.getLogger("uvicorn")


def get_chat_engine(
    chat_history: Optional[List[ChatMessage]] = None, **kwargs
) -> Workflow:
    # TODO: the EXAMPLE_TYPE could be passed as a chat config parameter?
    agent_type = os.getenv("EXAMPLE_TYPE", "").lower()
    match agent_type:
        case "choreography":
            agent = create_choreography(chat_history, **kwargs)
        case "orchestrator":
            agent = create_orchestrator(chat_history, **kwargs)
        case _:
            agent = create_workflow(chat_history, **kwargs)

    return agent

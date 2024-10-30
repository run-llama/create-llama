from typing import List, Optional

from app.agents.workflow import create_workflow
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.form_filling import Workflow


def get_chat_engine(
    chat_history: Optional[List[ChatMessage]] = None, **kwargs
) -> Workflow:
    return create_workflow(chat_history=chat_history, **kwargs)

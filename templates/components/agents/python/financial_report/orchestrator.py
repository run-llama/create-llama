from typing import List, Optional

from app.agents.analyst import create_analyst
from app.agents.reporter import create_reporter
from app.agents.researcher import create_researcher
from app.workflows.multi import AgentOrchestrator
from llama_index.core.chat_engine.types import ChatMessage


def create_orchestrator(chat_history: Optional[List[ChatMessage]] = None, **kwargs):
    researcher = create_researcher(chat_history, **kwargs)
    analyst = create_analyst(chat_history)
    reporter = create_reporter(chat_history)
    return AgentOrchestrator(
        agents=[researcher, analyst, reporter],
        refine_plan=False,
        chat_history=chat_history,
    )

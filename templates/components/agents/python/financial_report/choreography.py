from textwrap import dedent
from typing import List, Optional

from app.agents.analyst import create_analyst
from app.agents.researcher import create_researcher
from app.workflows.multi import AgentCallingAgent
from llama_index.core.chat_engine.types import ChatMessage


def create_choreography(chat_history: Optional[List[ChatMessage]] = None, **kwargs):
    researcher = create_researcher(chat_history, **kwargs)
    analyst = create_analyst(chat_history)
    return AgentCallingAgent(
        name="reporter",
        agents=[researcher, analyst],
        description="expert in writing financial reports, needs researched information and images to write a financial report",
        system_prompt=dedent(
            """
            You are an expert in writing financial reports. You are given a task to write a financial report. 
            Before starting to write the report, consult the researcher and analyst agents to get the information you need. 
            Finally, create a report with the information you have gathered in markdown format.
            Don't make up any information yourself.
        """
        ),
        # TODO: add chat_history support to AgentCallingAgent
        # chat_history=chat_history,
    )

from typing import Optional

from llama_index.core.agent.workflow import FunctionAgent, ReActAgent
from llama_index.core.llms import LLM
from llama_index.core.settings import Settings
from llama_index.server.tools.index import get_query_engine_tool


def create_citation_agent(
    index,
    llm: Optional[LLM] = None,
    name: Optional[str] = None,
    description: Optional[str] = None,
    system_prompt: Optional[str] = None,
) -> FunctionAgent | ReActAgent:
    """
    Create a citation agent that can answer question with citations using information from provided index.
    Example:
        ```python
            citation_agent = create_citation_agent(index=index)
            my_workflow = AgentWorkflow(agents=[citation_agent], root_agent=citation_agent.name)
            my_workflow.run(user_msg="Why is sky blue?")
        ```
    """
    llm = llm or Settings.llm
    agent_cls = FunctionAgent if llm.metadata.is_function_calling_model else ReActAgent
    name = name or "citation_agent"
    description = (
        description
        or "An agent that can answer questions with citations using information from provided index. Do not change the citations when restructuring the answer."
    )
    system_prompt = (
        system_prompt
        or """
        You are a helpful assistant that have access to a knowledge base.
        You can use the query_index tool to get the information you need.
        Answer the user question with citations for the parts that uses the information from the knowledge base.
        """
    )
    return agent_cls(
        name=name,
        description=description,
        tools=[get_query_engine_tool(index=index, enable_citation=True)],
        llm=llm or Settings.llm,
        system_prompt=system_prompt,
    )

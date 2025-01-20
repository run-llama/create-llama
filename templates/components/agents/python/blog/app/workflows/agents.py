from typing import List, Literal, Optional

from llama_index.core.base.llms.types import (
    CompletionResponse,
    CompletionResponseAsyncGen,
)
from llama_index.core.memory.simple_composable_memory import SimpleComposableMemory
from llama_index.core.prompts import PromptTemplate
from llama_index.core.schema import MetadataMode, Node, NodeWithScore
from llama_index.core.settings import Settings
from pydantic import BaseModel, Field


class AnalysisDecision(BaseModel):
    decision: Literal["research", "write"] = Field(
        description="Whether to research more or write a report"
    )
    research_questions: Optional[List[str]] = Field(
        description="The questions to be researched if the decision is to research more. Maximum 3 questions. Set it as null or empty if the decision is to write a report.",
        default_factory=list,
    )


async def plan_research(
    memory: SimpleComposableMemory,
    context_nodes: List[Node],
    user_request: str,
) -> AnalysisDecision:
    analyze_prompt = PromptTemplate(
        """
      You are a professor who are guiding a student to research on a specific request/problem. 
      Your task is to decide the plan for the student to research on the request.
      The action can be:
      + Provide a list of questions to the student to research on, the purpose is to clarify the request.
      + Write a report if the student already has already enough research on the topic and also albe to resolve the starter request.
      The workflow should be:
      + Always start with providing some starter questions to the student to research on. 
      + Analyze the provided answers with the starter topic/request. If the answers are not enough to resolve the starter request, provide more questions to the student to research on.
      + If the answers are enough to resolve the starter request, ask the student to write a report.
      <User request>
      {user_request}
      </User request>

      <Collected information>
      {context_str}
      </Collected information>

      <Conversation context>
      {conversation_context}
      </Conversation context>
      """
    )
    conversation_context = "\n".join(
        [f"{message.role}: {message.content}" for message in memory.get_all()]
    )
    context_str = "\n".join(
        [node.get_content(metadata_mode=MetadataMode.LLM) for node in context_nodes]
    )
    res = await Settings.llm.astructured_predict(
        output_cls=AnalysisDecision,
        prompt=analyze_prompt,
        user_request=user_request,
        context_str=context_str,
        conversation_context=conversation_context,
    )
    return res


async def research(
    question: str,
    context_nodes: List[NodeWithScore],
) -> str:
    prompt = """
    You are a researcher who are inprogress of answering the question.
    The purpose is to answer the question based on the collected information, no prior knowledge or making up any new information.
    Always add citations to the sentence/point/paragraph to the id of the provided content.
    The citation should follow this format: [citation:id]() where id is the id of the content.
    
    E.g:
    If we have a context like this:
    <Citation id='abc-xyz'>
    Baby llama is called cria
    </Citation id='abc-xyz'>

    And your answer uses the content, then the citation should be:
    - Baby llama is called cria [citation:abc-xyz]()

    Here is the provided context for the question:
    <Collected information>
    {context_str}
    </Collected information>`

    No prior knowledge, just use the provided context to answer the question: {question}
    """
    context_str = "\n".join(
        [_get_text_node_content_for_citation(node) for node in context_nodes]
    )
    res = await Settings.llm.acomplete(
        prompt=prompt.format(question=question, context_str=context_str),
    )
    return res.text


async def write_report(
    memory: SimpleComposableMemory,
    user_request: str,
    stream: bool = False,
) -> CompletionResponse | CompletionResponseAsyncGen:
    report_prompt = """
    You are a researcher who are writing a paper for a user request.
    You have research on the some perspective of the user request.
    You need to write a report for the user request based on the research.
    The report should be a great outline of the research and cover all the important points of the researched perspective.
    + Have a great outline for a research report. The outline should cover the researched perspective.
    + Represent in markdown format. If possible, use tables or figures to have better presentation.
    + Never remove citation information (the [citation:id]() part in the provided context). You should keep it in the final report.
    <User request>
    {user_request}
    </User request>

    <Research context>
    {research_context}
    </Research context>

    Now, write a report for the user request based on the research.
    """
    research_context = "\n".join(
        [f"{message.role}: {message.content}" for message in memory.get_all()]
    )

    llm_complete_func = (
        Settings.llm.astream_complete if stream else Settings.llm.acomplete
    )

    res = await llm_complete_func(
        prompt=report_prompt.format(
            user_request=user_request,
            research_context=research_context,
        ),
    )
    return res


def _get_text_node_content_for_citation(node: NodeWithScore) -> str:
    """
    Construct node content for LLM with citation flag.
    """
    node_id = node.node.node_id
    content = f"<Citation id='{node_id}'>\n{node.get_content(metadata_mode=MetadataMode.LLM)}</Citation id='{node_id}'>"
    return content

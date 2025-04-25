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
    decision: Literal["research", "write", "cancel"] = Field(
        description="Whether to continue research, write a report, or cancel the research after several retries"
    )
    research_questions: Optional[List[str]] = Field(
        description="""
        If the decision is to research, provide a list of questions to research that related to the user request.
        Maximum 3 questions. Set to null or empty if writing a report or cancel the research.
        """,
        default_factory=list,
    )
    cancel_reason: Optional[str] = Field(
        description="The reason for cancellation if the decision is to cancel research.",
        default=None,
    )


async def plan_research(
    memory: SimpleComposableMemory,
    context_nodes: List[Node],
    user_request: str,
    total_questions: int,
) -> AnalysisDecision:
    analyze_prompt = """
      You are a professor who is guiding a researcher to research a specific request/problem.
      Your task is to decide on a research plan for the researcher.

      The possible actions are:
      + Provide a list of questions for the researcher to investigate, with the purpose of clarifying the request.
      + Write a report if the researcher has already gathered enough research on the topic and can resolve the initial request.
      + Cancel the research if most of the answers from researchers indicate there is insufficient information to research the request. Do not attempt more than 3 research iterations or too many questions.

      The workflow should be:
      + Always begin by providing some initial questions for the researcher to investigate.
      + Analyze the provided answers against the initial topic/request. If the answers are insufficient to resolve the initial request, provide additional questions for the researcher to investigate.
      + If the answers are sufficient to resolve the initial request, instruct the researcher to write a report.

      Here are the context: 
      <Collected information>
      {context_str}
      </Collected information>

      <Conversation context>
      {conversation_context}
      </Conversation context>

      {enhanced_prompt}

      Now, provide your decision in the required format for this user request:
      <User request>
      {user_request}
      </User request>
      """
    # Manually craft the prompt to avoid LLM hallucination
    enhanced_prompt = ""
    if total_questions == 0:
        # Avoid writing a report without any research context
        enhanced_prompt = """
        
        The student has no questions to research. Let start by asking some questions.
        """
    elif total_questions > 6:
        # Avoid asking too many questions (when the data is not ready for writing a report)
        enhanced_prompt = f"""

        The student has researched {total_questions} questions. Should cancel the research if the context is not enough to write a report.
        """

    conversation_context = "\n".join(
        [f"{message.role}: {message.content}" for message in memory.get_all()]
    )
    context_str = "\n".join(
        [node.get_content(metadata_mode=MetadataMode.LLM) for node in context_nodes]
    )
    res = await Settings.llm.astructured_predict(
        output_cls=AnalysisDecision,
        prompt=PromptTemplate(template=analyze_prompt),
        user_request=user_request,
        context_str=context_str,
        conversation_context=conversation_context,
        enhanced_prompt=enhanced_prompt,
    )
    return res


async def research(
    question: str,
    context_nodes: List[NodeWithScore],
) -> str:
    prompt = """
    You are a researcher who is in the process of answering the question.
    The purpose is to answer the question based on the collected information, without using prior knowledge or making up any new information.
    Always add citations to the sentence/point/paragraph using the id of the provided content.
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
    You are a researcher writing a report based on a user request and the research context.
    You have researched various perspectives related to the user request.
    The report should provide a comprehensive outline covering all important points from the researched perspectives.
    Create a well-structured outline for the research report that covers all the answers.

    # IMPORTANT when writing in markdown format:
    + Use tables or figures where appropriate to enhance presentation.
    + Preserve all citation syntax (the `[citation:id]()` parts in the provided context). Keep these citations in the final report - no separate reference section is needed.
    + Do not add links, a table of contents, or a references section to the report.

    <User request>
    {user_request}
    </User request>

    <Research context>
    {research_context}
    </Research context>

    Now, write a report addressing the user request based on the research provided following the format and guidelines above.
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

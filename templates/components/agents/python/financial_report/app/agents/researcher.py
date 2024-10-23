import os
from textwrap import dedent
from typing import List, Optional

from app.engine.index import IndexConfig, get_index
from app.workflows.single import FunctionCallingAgent
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.tools import BaseTool, QueryEngineTool, ToolMetadata
from llama_index.indices.managed.llama_cloud import LlamaCloudIndex


def _create_query_engine_tools(params=None) -> Optional[list[type[BaseTool]]]:
    """
    Provide an agent worker that can be used to query the index.
    """
    # Add query tool if index exists
    index_config = IndexConfig(**(params or {}))
    index = get_index(index_config)
    if index is None:
        return None

    top_k = int(os.getenv("TOP_K", 5))

    # Construct query engine tools
    tools = []
    # If index is LlamaCloudIndex, we need to add chunk and doc retriever tools
    if isinstance(index, LlamaCloudIndex):
        # Document retriever
        doc_retriever = index.as_query_engine(
            retriever_mode="files_via_content",
            similarity_top_k=top_k,
        )
        chunk_retriever = index.as_query_engine(
            retriever_mode="chunks",
            similarity_top_k=top_k,
        )
        tools.append(
            QueryEngineTool(
                query_engine=doc_retriever,
                metadata=ToolMetadata(
                    name="document_retriever",
                    description=dedent(
                        """
                        Document retriever that retrieves entire documents from the corpus.
                        ONLY use for research questions that may require searching over entire research reports.
                        Will be slower and more expensive than chunk-level retrieval but may be necessary.
                        """
                    ),
                ),
            )
        )
        tools.append(
            QueryEngineTool(
                query_engine=chunk_retriever,
                metadata=ToolMetadata(
                    name="chunk_retriever",
                    description=dedent(
                        """
                        Retrieves a small set of relevant document chunks from the corpus.
                        Use for research questions that want to look up specific facts from the knowledge corpus,
                        and need entire documents.
                        """
                    ),
                ),
            )
        )
    else:
        query_engine = index.as_query_engine(
            **({"similarity_top_k": top_k} if top_k != 0 else {})
        )
        tools.append(
            QueryEngineTool(
                query_engine=query_engine,
                metadata=ToolMetadata(
                    name="retrieve_information",
                    description="Use this tool to retrieve information about the text corpus from the index.",
                ),
            )
        )
    return tools


def create_researcher(chat_history: List[ChatMessage], **kwargs):
    """
    Researcher is an agent that take responsibility for using tools to complete a given task.
    """
    tools = _create_query_engine_tools(**kwargs)

    if tools is None:
        raise ValueError("No tools found for researcher agent")

    return FunctionCallingAgent(
        name="researcher",
        tools=tools,
        description="expert in retrieving any unknown content from the corpus",
        system_prompt=dedent(
            """
            You are a researcher agent. You are responsible for retrieving information from the corpus.
            ## Instructions
            + Don't synthesize the information, just return the whole retrieved information.
            + Don't need to retrieve the information that is already provided in the chat history and response with: "There is no new information, please reuse the information from the conversation."
            """
        ),
        chat_history=chat_history,
    )

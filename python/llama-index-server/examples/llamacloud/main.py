import os
from typing import List, Optional

from fastapi import FastAPI
from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.query_engine.retriever_query_engine import RetrieverQueryEngine
from llama_index.core.settings import Settings
from llama_index.core.tools import QueryEngineTool, ToolMetadata
from llama_index.llms.openai import OpenAI
from llama_index.server import LlamaIndexServer, UIConfig
from llama_index.server.api.models import ChatRequest
from llama_index.server.services.llamacloud import LlamaCloudIndex, get_index
from llama_index.server.tools.index.citation import (
    CITATION_SYSTEM_PROMPT,
    enable_citation,
)

# Please set the following environment variables to use LlamaCloud
if os.getenv("LLAMA_CLOUD_API_KEY") is None:
    raise ValueError("LLAMA_CLOUD_API_KEY is not set")
if os.getenv("LLAMA_CLOUD_PROJECT_NAME") is None:
    raise ValueError("LLAMA_CLOUD_PROJECT_NAME is not set")
if os.getenv("LLAMA_CLOUD_INDEX_NAME") is None:
    raise ValueError("LLAMA_CLOUD_INDEX_NAME is not set")

Settings.llm = OpenAI(model="gpt-4.1")


def get_tools(index: LlamaCloudIndex) -> List[QueryEngineTool]:
    """
    Get the tools for the given index.
    """

    chunk_retriever = index.as_retriever(
        retrieval_mode="chunks",
        rerank_top_n=15,
        dense_similarity_top_k=1,
    )
    doc_retriever = index.as_retriever(
        retrieval_mode="files_via_content",
        files_top_k=1,
    )

    # You can either create query engine with CitationSynthesizer and NodeCitationProcessor
    # or use the enable_citation function to enable citation for the query engine.
    chunk_engine = RetrieverQueryEngine.from_args(
        retriever=chunk_retriever,
        llm=Settings.llm,
    )
    doc_engine = RetrieverQueryEngine.from_args(
        retriever=doc_retriever,
        llm=Settings.llm,
    )

    chunk_tool = QueryEngineTool(
        query_engine=chunk_engine,
        metadata=ToolMetadata(
            name="chunk_query_engine",
            description=(
                "Get answer from specific chunk of a given document. Best used for lower-level questions that require specific information from a given document."
                "Do NOT use if the answer can be found in the entire document. Use the file_query_engine instead for that purpose"
            ),
        ),
    )
    doc_tool = QueryEngineTool(
        query_engine=doc_engine,
        metadata=ToolMetadata(
            name="file_query_engine",
            description=(
                "Get answer from entire document as context.  Best used for higher-level summarization questions."
                "Do NOT use if the answer can be found in a specific chunk of a given document. Use the chunk_query_engine instead for that purpose"
            ),
        ),
    )

    return [enable_citation(chunk_tool), enable_citation(doc_tool)]


def create_workflow(chat_request: Optional[ChatRequest] = None) -> AgentWorkflow:
    index = get_index(chat_request=chat_request)
    if index is None:
        raise RuntimeError("Index not found!")

    # Append the citation system prompt to the system prompt
    system_prompt = """
    You are a helpful assistant that has access to a knowledge base.
    """
    system_prompt += CITATION_SYSTEM_PROMPT
    return AgentWorkflow.from_tools_or_functions(
        tools_or_functions=get_tools(index),
        system_prompt=system_prompt,
    )


def create_app() -> FastAPI:
    app = LlamaIndexServer(
        workflow_factory=create_workflow,
        env="dev",
        suggest_next_questions=False,
        ui_config=UIConfig(
            llamacloud_index_selector=True,  # to select different indexes in the UI
        ),
    )
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

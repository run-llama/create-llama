import logging
import os
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from llama_index.core.chat_engine.types import BaseChatEngine, NodeWithScore
from llama_index.core.llms import MessageRole
from llama_index.core.vector_stores.types import MetadataFilter, MetadataFilters

from app.api.controllers.llama_cloud import LLamaCloudFileController
from app.api.routers.events import EventCallbackHandler
from app.api.routers.models import (
    ChatConfig,
    ChatData,
    Message,
    Result,
    SourceNodes,
)
from app.api.routers.vercel_response import VercelStreamResponse
from app.engine import get_chat_engine

chat_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


def process_response_nodes(
    nodes: List[NodeWithScore],
    background_tasks: BackgroundTasks,
):
    """
    Start background tasks on the source nodes if needed.
    """
    files_to_download = SourceNodes.get_download_files(nodes)
    for file in files_to_download:
        background_tasks.add_task(
            LLamaCloudFileController.download_llamacloud_pipeline_file,
            file_name=file.get("file_name"),
            pipeline_id=file.get("pipeline_id"),
        )


# streaming endpoint - delete if not needed
@r.post("")
async def chat(
    request: Request,
    data: ChatData,
    background_tasks: BackgroundTasks,
    chat_engine: BaseChatEngine = Depends(get_chat_engine),
):
    try:
        last_message_content = data.get_last_message_content()
        messages = data.get_history_messages()

        doc_ids = data.get_chat_document_ids()
        filters = generate_filters(doc_ids)
        logger.info("Creating chat engine with filters", filters.dict())
        chat_engine = get_chat_engine(filters=filters)

        event_handler = EventCallbackHandler()
        chat_engine.callback_manager.handlers.append(event_handler)  # type: ignore

        response = await chat_engine.astream_chat(last_message_content, messages)
        process_response_nodes(response.source_nodes, background_tasks)

        return VercelStreamResponse(request, event_handler, response)
    except Exception as e:
        logger.exception("Error in chat engine", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in chat engine: {e}",
        ) from e


def generate_filters(doc_ids):
    if len(doc_ids) > 0:
        filters = MetadataFilters(
            filters=[
                MetadataFilter(
                    key="private",
                    value="true",
                    operator="!=",  # type: ignore
                ),
                MetadataFilter(
                    key="doc_id",
                    value=doc_ids,
                    operator="in",  # type: ignore
                ),
            ],
            condition="or",  # type: ignore
        )
    else:
        filters = MetadataFilters(
            # Use the "NIN" - "not in" operator to include documents that either don't have the private key 
            # or have it set to `false`.
            # You can change to "!=" - "not equal" operator if the documents always have the private key 
            # to improve performance
            filters=[
                MetadataFilter(
                    key="private",
                    value=["true"],
                    operator="nin",  # type: ignore
                ),
            ]
        )

    return filters


# non-streaming endpoint - delete if not needed
@r.post("/request")
async def chat_request(
    data: ChatData,
    chat_engine: BaseChatEngine = Depends(get_chat_engine),
) -> Result:
    last_message_content = data.get_last_message_content()
    messages = data.get_history_messages()

    response = await chat_engine.achat(last_message_content, messages)
    return Result(
        result=Message(role=MessageRole.ASSISTANT, content=response.response),
        nodes=SourceNodes.from_source_nodes(response.source_nodes),
    )


@r.get("/config")
async def chat_config() -> ChatConfig:
    starter_questions = None
    conversation_starters = os.getenv("CONVERSATION_STARTERS")
    if conversation_starters and conversation_starters.strip():
        starter_questions = conversation_starters.strip().split("\n")
    return ChatConfig(starter_questions=starter_questions)

import logging
import os
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from llama_index.core.chat_engine.types import BaseChatEngine
from llama_index.core.llms import MessageRole
from llama_index.core.vector_stores.types import MetadataFilter, MetadataFilters

from app.api.routers.events import EventCallbackHandler
from app.api.routers.models import (
    ChatConfig,
    ChatData,
    Message,
    Result,
    SourceNodes,
)
from app.api.routers.vercel_response import VercelStreamResponse
from app.api.services.suggestion import NextQuestionSuggestion
from app.engine import get_chat_engine

chat_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


# streaming endpoint - delete if not needed
@r.post("")
async def chat(
    request: Request,
    data: ChatData,
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
            filters=[
                MetadataFilter(
                    key="private",
                    value="true",
                    operator="!=",  # type: ignore
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


@r.get("/suggest-questions")
async def suggest_questions(
    request: Request,
    data: ChatData,
    num_questions: int = 3,
) -> List[str]:
    try:
        # Get last message, only suggest if the message from assistant
        messages = data.messages
        last_message = messages[-1]

        if last_message is not None and last_message.role != "assistant":
            return []
        suggestions = await NextQuestionSuggestion.suggest_next_questions(
            messages, num_questions
        )
        return suggestions
    except Exception as e:
        logger.exception("Error in suggestion engine", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in suggestion engine: {e}",
        ) from e

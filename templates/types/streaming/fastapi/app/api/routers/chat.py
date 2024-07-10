import os
import logging

from aiostream import stream
from fastapi import APIRouter, Depends, HTTPException, Request, status
from llama_index.core.llms import MessageRole
from llama_index.core.chat_engine.types import BaseChatEngine
from llama_index.core.vector_stores.types import MetadataFilters, MetadataFilter
from app.engine import get_chat_engine
from app.api.routers.vercel_response import VercelStreamResponse
from app.api.routers.events import EventCallbackHandler
from app.api.routers.models import (
    ChatData,
    ChatConfig,
    SourceNodes,
    Result,
    Message,
)

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
        if len(doc_ids) > 0:
            filters = MetadataFilters(
                filters=[
                    MetadataFilter(
                        key="private",
                        value="true",
                        operator="!=", # type: ignore
                    ),
                    MetadataFilter(
                        key="doc_id",
                        value=doc_ids,
                        operator="in", # type: ignore . This won't work with a simple vector store since it uses the 'any' operator for that.
                    )
                ],
                condition="or", # type: ignore
            )
        else:
            filters = MetadataFilters(
                filters=[
                    MetadataFilter(
                        key="private",
                        value="true",
                        operator="!=", # type: ignore
                    ),
                ]
            )
        logger.info("Creating chat engine with filters", filters.dict())
        chat_engine = get_chat_engine(filters=filters)

        event_handler = EventCallbackHandler()
        chat_engine.callback_manager.handlers.append(event_handler)  # type: ignore

        async def content_generator():
            # Yield the text response
            async def _chat_response_generator():
                response = await chat_engine.astream_chat(
                    last_message_content, messages
                )
                async for token in response.async_response_gen():
                    yield VercelStreamResponse.convert_text(token)
                # the text_generator is the leading stream, once it's finished, also finish the event stream
                event_handler.is_done = True

                # Yield the source nodes
                yield VercelStreamResponse.convert_data(
                    {
                        "type": "sources",
                        "data": {
                            "nodes": [
                                SourceNodes.from_source_node(node).dict()
                                for node in response.source_nodes
                            ]
                        },
                    }
                )

            # Yield the events from the event handler
            async def _event_generator():
                async for event in event_handler.async_event_gen():
                    event_response = event.to_response()
                    if event_response is not None:
                        yield VercelStreamResponse.convert_data(event_response)

            combine = stream.merge(_chat_response_generator(), _event_generator())
            is_stream_started = False
            async with combine.stream() as streamer:
                async for output in streamer:
                    if not is_stream_started:
                        is_stream_started = True
                        # Stream a blank message to start the stream
                        yield VercelStreamResponse.convert_text("")

                    yield output

                    if await request.is_disconnected():
                        break

        return VercelStreamResponse(content=content_generator())
    except Exception as e:
        logger.exception("Error in chat engine", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in chat engine: {e}",
        ) from e


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

import os
import logging
from pydantic import BaseModel
from typing import List, Any, Optional, Dict, Tuple
from fastapi import APIRouter, Depends, HTTPException, Request, status
from llama_index.core.chat_engine.types import BaseChatEngine
from llama_index.core.schema import NodeWithScore
from llama_index.core.llms import ChatMessage, MessageRole
from app.engine import get_chat_engine
from app.api.routers.vercel_response import VercelStreamResponse
from app.api.routers.messaging import EventCallbackHandler
from aiostream import stream

chat_router = r = APIRouter()

logger = logging.getLogger("uvicorn")

class _Message(BaseModel):
    role: MessageRole
    content: str


class _ChatData(BaseModel):
    messages: List[_Message]

    class Config:
        json_schema_extra = {
            "example": {
                "messages": [
                    {
                        "role": "user",
                        "content": "What standards for letters exist?",
                    }
                ]
            }
        }


class _SourceNodes(BaseModel):
    id: str
    metadata: Dict[str, Any]
    score: Optional[float]
    text: str
    url: Optional[str]

    @classmethod
    def from_source_node(cls, source_node: NodeWithScore):
        metadata = source_node.node.metadata
        url = metadata.get("URL")
        
        if not url:
            file_name = metadata.get("file_name")
            url_prefix = os.getenv("FILESERVER_URL_PREFIX")
            if not url_prefix:
                logger.warning("Warning: FILESERVER_URL_PREFIX not set in environment variables")
            if file_name and url_prefix:
                url = f"{url_prefix}/data/{file_name}"

        return cls(
            id=source_node.node.node_id,
            metadata=metadata,
            score=source_node.score,
            text=source_node.node.text,  # type: ignore
            url=url
        )

    @classmethod
    def from_source_nodes(cls, source_nodes: List[NodeWithScore]):
        return [cls.from_source_node(node) for node in source_nodes]


class _Result(BaseModel):
    result: _Message
    nodes: List[_SourceNodes]


async def parse_chat_data(data: _ChatData) -> Tuple[str, List[ChatMessage]]:
    # check preconditions and get last message
    if len(data.messages) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No messages provided",
        )
    last_message = data.messages.pop()
    if last_message.role != MessageRole.USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Last message must be from user",
        )
    # convert messages coming from the request to type ChatMessage
    messages = [
        ChatMessage(
            role=m.role,
            content=m.content,
        )
        for m in data.messages
    ]
    return last_message.content, messages


# streaming endpoint - delete if not needed
@r.post("")
async def chat(
    request: Request,
    data: _ChatData,
    chat_engine: BaseChatEngine = Depends(get_chat_engine),
):
    last_message_content, messages = await parse_chat_data(data)

    event_handler = EventCallbackHandler()
    chat_engine.callback_manager.handlers.append(event_handler)  # type: ignore
    try:
        response = await chat_engine.astream_chat(last_message_content, messages)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in chat engine: {e}",
        )

    async def content_generator():
        # Yield the text response
        async def _text_generator():
            async for token in response.async_response_gen():
                yield VercelStreamResponse.convert_text(token)
            # the text_generator is the leading stream, once it's finished, also finish the event stream
            event_handler.is_done = True

        # Yield the events from the event handler
        async def _event_generator():
            async for event in event_handler.async_event_gen():
                event_response = event.to_response()
                if event_response is not None:
                    yield VercelStreamResponse.convert_data(event_response)

        combine = stream.merge(_text_generator(), _event_generator())
        async with combine.stream() as streamer:
            async for item in streamer:
                if await request.is_disconnected():
                    break
                yield item

        # Yield the source nodes
        yield VercelStreamResponse.convert_data(
            {
                "type": "sources",
                "data": {
                    "nodes": [
                        _SourceNodes.from_source_node(node).dict()
                        for node in response.source_nodes
                    ]
                },
            }
        )

    return VercelStreamResponse(content=content_generator())


# non-streaming endpoint - delete if not needed
@r.post("/request")
async def chat_request(
    data: _ChatData,
    chat_engine: BaseChatEngine = Depends(get_chat_engine),
) -> _Result:
    last_message_content, messages = await parse_chat_data(data)

    response = await chat_engine.achat(last_message_content, messages)
    return _Result(
        result=_Message(role=MessageRole.ASSISTANT, content=response.response),
        nodes=_SourceNodes.from_source_nodes(response.source_nodes),
    )

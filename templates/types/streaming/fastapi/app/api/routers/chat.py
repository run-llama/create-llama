import json
from dataclasses import field
from pydantic import BaseModel
from typing import List, Any, Optional, Dict, Tuple
from fastapi.responses import StreamingResponse
from fastapi import APIRouter, Depends, HTTPException, Request, status
from llama_index.core.chat_engine.types import (
    BaseChatEngine,
    StreamingAgentChatResponse,
)
from llama_index.core.schema import NodeWithScore
from llama_index.core.llms import ChatMessage, MessageRole
from app.engine import get_chat_engine

chat_router = r = APIRouter()


class _Message(BaseModel):
    role: MessageRole
    content: str


class _ChatData(BaseModel):
    messages: List[_Message]


class _SourceNodes(BaseModel):
    id: str
    metadata: Dict[str, Any]
    score: Optional[float]

    @classmethod
    def from_source_node(cls, source_node: NodeWithScore):
        return cls(
            id=source_node.node.node_id,
            metadata=source_node.node.metadata,
            score=source_node.score,
        )

    @classmethod
    def from_source_nodes(cls, source_nodes: List[NodeWithScore]):
        return [cls.from_source_node(node) for node in source_nodes]


class _Result(BaseModel):
    result: _Message
    nodes: List[_SourceNodes]


class VercelStreamResponse(StreamingResponse):
    """
    Class to convert the response from the chat engine to the streaming format expected by Vercel
    """

    TEXT_PREFIX = "0:"
    DATA_PREFIX = "2:"
    VERCEL_HEADERS = {
        "X-Experimental-Stream-Data": "true",
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Expose-Headers": "X-Experimental-Stream-Data",
    }

    @classmethod
    def convert_text(cls, token: str):
        return f'{cls.TEXT_PREFIX}"{token}"\n'

    @classmethod
    def convert_data(cls, data: dict):
        data_str = json.dumps(data)
        return f"{cls.DATA_PREFIX}[{data_str}]\n"

    @classmethod
    async def event_generator(
        cls, request: Request, response: StreamingAgentChatResponse
    ):
        # Yield the text response
        async for token in response.async_response_gen():
            # If client closes connection, stop sending events
            if await request.is_disconnected():
                break
            yield cls.convert_text(token)

        # Yield the source nodes
        yield cls.convert_data(
            {
                "nodes": [
                    _SourceNodes.from_source_node(node).dict()
                    for node in response.source_nodes
                ]
            }
        )

    def __init__(self, content: Any, **kwargs):
        super().__init__(
            content=content,
            headers=self.VERCEL_HEADERS,
            **kwargs,
        )


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

    response = await chat_engine.astream_chat(last_message_content, messages)

    return VercelStreamResponse(
        content=VercelStreamResponse.event_generator(request, response)
    )


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

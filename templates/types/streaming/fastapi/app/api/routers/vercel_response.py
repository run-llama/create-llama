import json
from typing import Any
from fastapi.responses import StreamingResponse

from app.api.routers.events import EventCallbackHandler
from aiostream import stream

from app.api.routers.models import SourceNodes
from fastapi import Request
from llama_index.core.chat_engine.types import StreamingAgentChatResponse


class VercelStreamResponse(StreamingResponse):
    """
    Class to convert the response from the chat engine to the streaming format expected by Vercel
    """

    TEXT_PREFIX = "0:"
    DATA_PREFIX = "8:"

    @classmethod
    def convert_text(cls, token: str):
        # Escape newlines and double quotes to avoid breaking the stream
        token = json.dumps(token)
        return f"{cls.TEXT_PREFIX}{token}\n"

    @classmethod
    def convert_data(cls, data: dict):
        data_str = json.dumps(data)
        return f"{cls.DATA_PREFIX}[{data_str}]\n"

    def __init__(
        self,
        request: Request,
        event_handler: EventCallbackHandler,
        response: StreamingAgentChatResponse,
    ):
        content = VercelStreamResponse.content_generator(
            request, event_handler, response
        )
        super().__init__(content=content)

    @classmethod
    async def content_generator(
        cls,
        request: Request,
        event_handler: EventCallbackHandler,
        response: StreamingAgentChatResponse,
    ):
        # Yield the text response
        async def _chat_response_generator():
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

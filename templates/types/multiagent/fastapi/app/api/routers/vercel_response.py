from asyncio import Task
import json
import logging
from typing import AsyncGenerator

from aiostream import stream
from fastapi import Request
from fastapi.responses import StreamingResponse

from app.api.routers.models import ChatData
from app.agents.single import AgentRunEvent, AgentRunResult

logger = logging.getLogger("uvicorn")


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
        task: Task[AgentRunResult | AsyncGenerator],
        events: AsyncGenerator[AgentRunEvent, None],
        chat_data: ChatData,
        verbose: bool = True,
    ):
        content = VercelStreamResponse.content_generator(
            request, task, events, chat_data, verbose
        )
        super().__init__(content=content)

    @classmethod
    async def content_generator(
        cls,
        request: Request,
        task: Task[AgentRunResult | AsyncGenerator],
        events: AsyncGenerator[AgentRunEvent, None],
        chat_data: ChatData,
        verbose: bool = True,
    ):
        # Yield the text response
        async def _chat_response_generator():
            result = await task

            if isinstance(result, AgentRunResult):
                for token in result.response.message.content:
                    yield VercelStreamResponse.convert_text(token)

            if isinstance(result, AsyncGenerator):
                async for token in result:
                    yield VercelStreamResponse.convert_text(token.delta)

            # TODO: stream NextQuestionSuggestion
            # TODO: stream sources

        # Yield the events from the event handler
        async def _event_generator():
            async for event in events():
                event_response = _event_to_response(event)
                if verbose:
                    logger.debug(event_response)
                if event_response is not None:
                    yield VercelStreamResponse.convert_data(event_response)

        combine = stream.merge(_chat_response_generator(), _event_generator())

        is_stream_started = False
        async with combine.stream() as streamer:
            if not is_stream_started:
                is_stream_started = True
                # Stream a blank message to start the stream
                yield VercelStreamResponse.convert_text("")

            async for output in streamer:
                yield output
                if await request.is_disconnected():
                    break


def _event_to_response(event: AgentRunEvent) -> dict:
    return {
        "type": "agent",
        "data": {"agent": event.name, "text": event.msg},
    }

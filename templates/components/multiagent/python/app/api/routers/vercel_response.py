import json
import logging
from typing import AsyncGenerator, List, Type

from fastapi import Request
from fastapi.responses import StreamingResponse
from llama_index.core.agent.workflow.workflow_events import AgentStream
from llama_index.core.workflow import Event, StopEvent

logger = logging.getLogger("uvicorn")


class VercelStreamResponse(StreamingResponse):
    """
    Converts preprocessed events into Vercel-compatible streaming response format.
    """

    TEXT_PREFIX = "0:"
    DATA_PREFIX = "8:"
    ERROR_PREFIX = "3:"

    def __init__(
        self,
        request: Request,
        event_streams: AsyncGenerator[Event, None],
        excluded_events: List[Type[Event]] = [],
        *args,
        **kwargs,
    ):
        self.request = request
        self.event_streams = event_streams
        self.excluded_events = excluded_events
        content = self.content_generator()
        super().__init__(content=content)

    async def content_generator(self):
        """Generate Vercel-formatted content from preprocessed events."""
        stream_started = False
        try:
            async for event in self.event_streams:
                if not stream_started:
                    # Start the stream with an empty message
                    stream_started = True
                    yield self.convert_text("")

                # Text
                if isinstance(event, AgentStream):
                    yield self.convert_text(event.delta)
                elif isinstance(event, StopEvent):
                    yield self.convert_text(str(event.result))
                # Data
                else:
                    if hasattr(event, "to_response"):
                        yield self.convert_data(event.to_response())
                    else:
                        yield self.convert_data(event.model_dump())
        except Exception as e:
            logger.error(f"Error in stream response: {e}")
            yield self.convert_error(str(e))

    @classmethod
    def convert_text(cls, token: str) -> str:
        """Convert text event to Vercel format."""
        # Escape newlines and double quotes to avoid breaking the stream
        token = json.dumps(token)
        return f"{cls.TEXT_PREFIX}{token}\n"

    @classmethod
    def convert_data(cls, data: dict) -> str:
        """Convert data event to Vercel format."""
        data_str = json.dumps(data)
        return f"{cls.DATA_PREFIX}[{data_str}]\n"

    @classmethod
    def convert_error(cls, error: str) -> str:
        """Convert error event to Vercel format."""
        error_str = json.dumps(error)
        return f"{cls.ERROR_PREFIX}{error_str}\n"

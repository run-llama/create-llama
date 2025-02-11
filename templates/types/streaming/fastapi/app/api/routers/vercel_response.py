import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi.responses import StreamingResponse
from llama_index.core.agent.workflow.workflow_events import AgentStream
from llama_index.core.workflow import StopEvent

from app.api.callbacks.stream_handler import StreamHandler

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
        stream_handler: StreamHandler,
        *args,
        **kwargs,
    ):
        self.handler = stream_handler
        super().__init__(content=self.content_generator())

    async def content_generator(self):
        """Generate Vercel-formatted content from preprocessed events."""
        stream_started = False
        try:
            async for event in self.handler.stream_events():
                if not stream_started:
                    # Start the stream with an empty message
                    stream_started = True
                    yield self.convert_text("")

                # Handle different types of events
                if isinstance(event, (AgentStream, StopEvent)):
                    async for chunk in self._stream_text(event):
                        await self.handler.accumulate_text(chunk)
                        yield self.convert_text(chunk)
                elif isinstance(event, dict):
                    yield self.convert_data(event)
                elif hasattr(event, "to_response"):
                    event_response = event.to_response()
                    yield self.convert_data(event_response)
                else:
                    yield self.convert_data(
                        {"type": "agent", "data": event.model_dump()}
                    )

        except asyncio.CancelledError:
            logger.warning("Client cancelled the request!")
            await self.handler.cancel_run()
        except Exception as e:
            logger.error(f"Error in stream response: {e}")
            yield self.convert_error(str(e))
            await self.handler.cancel_run()

    async def _stream_text(
        self, event: AgentStream | StopEvent
    ) -> AsyncGenerator[str, None]:
        """
        Accept stream text from either AgentStream or StopEvent with string or AsyncGenerator result
        """
        if isinstance(event, AgentStream):
            yield event.delta
        elif isinstance(event, StopEvent):
            if isinstance(event.result, str):
                yield event.result
            elif isinstance(event.result, AsyncGenerator):
                async for chunk in event.result:
                    if isinstance(chunk, str):
                        yield chunk
                    elif hasattr(chunk, "delta"):
                        yield chunk.delta

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

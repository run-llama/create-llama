import asyncio
import json
import logging
from typing import AsyncGenerator, List

from fastapi import BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from llama_index.core.agent.workflow.workflow_events import AgentStream
from llama_index.core.schema import NodeWithScore
from llama_index.core.workflow import StopEvent
from llama_index.core.workflow.handler import WorkflowHandler

from app.api.routers.models import ChatData, Message
from app.api.services.suggestion import NextQuestionSuggestion

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
        handler: WorkflowHandler,
        chat_data: ChatData,
        background_tasks: BackgroundTasks,
        *args,
        **kwargs,
    ):
        self.request = request
        self.handler = handler
        self.chat_data = chat_data
        self.background_tasks = background_tasks
        content = self.content_generator()
        super().__init__(content=content)

    async def content_generator(self):
        """Generate Vercel-formatted content from preprocessed events."""
        stream_started = False
        final_response = ""
        try:
            async for event in self.handler.stream_events():
                if not stream_started:
                    # Start the stream with an empty message
                    stream_started = True
                    yield self.convert_text("")

                # Text
                if isinstance(event, AgentStream | StopEvent):
                    async for chunk in self._stream_text(event):
                        if isinstance(chunk, str):
                            final_response += chunk.replace(self.TEXT_PREFIX, "").strip(
                                '"\n'
                            )
                        yield chunk
                # Data
                elif hasattr(event, "to_response"):
                    event_response = event.to_response()
                    if event_response.get("type") == "sources":
                        self._process_response_nodes(event.nodes, self.background_tasks)
                    yield self.convert_data(event_response)
                else:
                    yield self.convert_data(event.model_dump())

            # Generate next questions after the final response
            if final_response:
                question_data = await self._generate_next_questions(
                    self.chat_data.messages, final_response
                )
                if question_data:
                    yield self.convert_data(question_data)

        except asyncio.CancelledError:
            logger.warning("Client cancelled the request!")
            await self.handler.cancel_run()
        except Exception as e:
            logger.error(f"Error in stream response: {e}")
            yield self.convert_error(str(e))
            await self.handler.cancel_run()

    @staticmethod
    def _process_response_nodes(
        source_nodes: List[NodeWithScore],
        background_tasks: BackgroundTasks,
    ):
        try:
            # Start background tasks to download documents from LlamaCloud if needed
            from app.engine.service import LLamaCloudFileService  # type: ignore

            LLamaCloudFileService.download_files_from_nodes(
                source_nodes, background_tasks
            )
        except ImportError:
            logger.debug(
                "LlamaCloud is not configured. Skipping post processing of nodes"
            )
            pass

    @staticmethod
    async def _generate_next_questions(chat_history: List[Message], response: str):
        questions = await NextQuestionSuggestion.suggest_next_questions(
            chat_history, response
        )
        if questions:
            return {
                "type": "suggested_questions",
                "data": questions,
            }
        return None

    async def _stream_text(
        self, event: AgentStream | StopEvent
    ) -> AsyncGenerator[str, None]:
        """
        Accept stream text from either AgentStream or StopEvent with string or AsyncGenerator result
        """
        if isinstance(event, AgentStream):
            yield self.convert_text(event.delta)
        elif isinstance(event, StopEvent):
            if isinstance(event.result, str):
                yield self.convert_text(event.result)
            elif isinstance(event.result, AsyncGenerator):
                async for chunk in event.result:
                    if isinstance(chunk, str):
                        yield self.convert_text(chunk)
                    elif hasattr(chunk, "delta"):
                        yield self.convert_text(chunk.delta)

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

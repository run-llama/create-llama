import asyncio
import json
import logging
from typing import AsyncGenerator, Awaitable, List

from aiostream import stream
from fastapi import BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from llama_index.core.schema import NodeWithScore

from app.api.routers.models import ChatData, Message
from app.api.services.suggestion import NextQuestionSuggestion

logger = logging.getLogger("uvicorn")


class VercelStreamResponse(StreamingResponse):
    """
    Base class to convert the response from the chat engine to the streaming format expected by Vercel
    """

    TEXT_PREFIX = "0:"
    DATA_PREFIX = "8:"
    ERROR_PREFIX = "3:"

    def __init__(
        self,
        request: Request,
        chat_data: ChatData,
        background_tasks: BackgroundTasks,
        *args,
        **kwargs,
    ):
        self.request = request
        self.chat_data = chat_data
        self.background_tasks = background_tasks
        content = self.content_generator(*args, **kwargs)
        super().__init__(content=content)

    async def content_generator(self, event_handler, events):
        stream = self._create_stream(
            self.request, self.chat_data, event_handler, events
        )
        is_stream_started = False
        try:
            async with stream.stream() as streamer:
                async for output in streamer:
                    if not is_stream_started:
                        is_stream_started = True
                        # Stream a blank message to start the stream
                        yield self.convert_text("")

                    yield output
        except asyncio.CancelledError:
            logger.warning("Workflow has been cancelled!")
        except Exception as e:
            logger.error(
                f"Unexpected error in content_generator: {str(e)}", exc_info=True
            )
            yield self.convert_error(
                "An unexpected error occurred while processing your request, preventing the creation of a final answer. Please try again."
            )
        finally:
            await event_handler.cancel_run()
            logger.info("The stream has been stopped!")

    def _create_stream(
        self,
        request: Request,
        chat_data: ChatData,
        event_handler: Awaitable,
        events: AsyncGenerator,
        verbose: bool = True,
    ):
        # Yield the text response
        async def _chat_response_generator():
            result = await event_handler
            final_response = ""

            if isinstance(result, AsyncGenerator):
                async for token in result:
                    final_response += str(token.delta)
                    yield self.convert_text(token.delta)
            else:
                if hasattr(result, "response"):
                    content = result.response.message.content
                    if content:
                        for token in content:
                            final_response += str(token)
                            yield self.convert_text(token)
                else:
                    final_response += str(result)
                    yield self.convert_text(result)

            # Generate next questions if next question prompt is configured
            question_data = await self._generate_next_questions(
                chat_data.messages, final_response
            )
            if question_data:
                yield self.convert_data(question_data)

        # Yield the events from the event handler
        async def _event_generator():
            async for event in events:
                event_response = event.to_response()
                if verbose:
                    logger.debug(event_response)
                if event_response is not None:
                    yield self.convert_data(event_response)
                if event_response.get("type") == "sources":
                    self._process_response_nodes(event.nodes, self.background_tasks)

        combine = stream.merge(_chat_response_generator(), _event_generator())
        return combine

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

    @classmethod
    def convert_text(cls, token: str):
        # Escape newlines and double quotes to avoid breaking the stream
        token = json.dumps(token)
        return f"{cls.TEXT_PREFIX}{token}\n"

    @classmethod
    def convert_data(cls, data: dict):
        data_str = json.dumps(data)
        return f"{cls.DATA_PREFIX}[{data_str}]\n"

    @classmethod
    def convert_error(cls, error: str):
        error_str = json.dumps(error)
        return f"{cls.ERROR_PREFIX}{error_str}\n"

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

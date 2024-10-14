import json
import logging
from typing import List

from aiostream import stream
from fastapi import BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from llama_index.core.chat_engine.types import StreamingAgentChatResponse
from llama_index.core.schema import RelatedNodeInfo

from app.api.routers.events import EventCallbackHandler
from app.api.routers.models import ChatData, Message, SourceNodes
from app.api.services.suggestion import NextQuestionSuggestion

logger = logging.getLogger("uvicorn")


class VercelStreamResponse(StreamingResponse):
    """
    Class to convert the response from the chat engine to the streaming format expected by Vercel
    """

    TEXT_PREFIX = "0:"
    DATA_PREFIX = "8:"

    def __init__(
        self,
        request: Request,
        event_handler: EventCallbackHandler,
        response: StreamingAgentChatResponse,
        chat_data: ChatData,
        background_tasks: BackgroundTasks,
    ):
        content = VercelStreamResponse.content_generator(
            request, event_handler, response, chat_data, background_tasks
        )
        super().__init__(content=content)

    @classmethod
    async def content_generator(
        cls,
        request: Request,
        event_handler: EventCallbackHandler,
        response: StreamingAgentChatResponse,
        chat_data: ChatData,
        background_tasks: BackgroundTasks,
    ):
        # Yield the events from the event handler
        async def _event_generator():
            async for event in event_handler.async_event_gen():
                event_response = event.to_response()
                if event_response is not None:
                    yield cls.convert_data(event_response)

        # Yield the text response
        async def _chat_response_generator():
            # Wait for the response from the chat engine
            result = await response

            # Once we got a source node, start a background task to download the files (if needed)
            cls._download_llamacloud_files(result.source_nodes, background_tasks)

            # Yield the source nodes
            yield cls.convert_data(
                {
                    "type": "sources",
                    "data": {
                        "nodes": [
                            SourceNodes.from_source_node(node).model_dump()
                            for node in result.source_nodes
                        ]
                    },
                }
            )

            final_response = ""
            async for token in result.async_response_gen():
                final_response += token
                yield cls.convert_text(token)

            # Generate next questions if next question prompt is configured
            question_data = await cls._generate_next_questions(
                chat_data.messages, final_response
            )
            if question_data:
                yield cls.convert_data(question_data)

            # the text_generator is the leading stream, once it's finished, also finish the event stream
            event_handler.is_done = True

        # Merge the chat response generator and the event generator
        combine = stream.merge(_chat_response_generator(), _event_generator())
        is_stream_started = False
        async with combine.stream() as streamer:
            async for output in streamer:
                if not is_stream_started:
                    is_stream_started = True
                    # Stream a blank message to start displaying the response in the UI
                    yield cls.convert_text("")

                yield output

                if await request.is_disconnected():
                    break

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
    def _download_llamacloud_files(
        cls,
        source_nodes: List[RelatedNodeInfo],
        background_tasks: BackgroundTasks,
    ):
        try:
            # Start background tasks to download documents from LlamaCloud if needed
            from app.engine.service import LLamaCloudFileService

            LLamaCloudFileService.download_files_from_nodes(
                source_nodes, background_tasks
            )
        except ImportError:
            logger.debug(
                "LlamaCloud is not configured. Skipping post processing of nodes"
            )
            pass

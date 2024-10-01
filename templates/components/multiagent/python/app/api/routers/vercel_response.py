import json
import logging
from typing import AsyncGenerator, List

from aiostream import stream
from app.agents.single import AgentRunEvent, AgentRunResult
from app.api.routers.events import EventCallbackHandler
from app.api.routers.models import ChatData, Message
from app.api.services.suggestion import NextQuestionSuggestion
from fastapi import Request
from fastapi.responses import StreamingResponse
from llama_index.core.chat_engine.types import StreamingAgentChatResponse

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
        event_handler: EventCallbackHandler,
        response: StreamingAgentChatResponse,
        chat_data: ChatData,
    ):
        content = VercelStreamResponse.content_generator(
            request, event_handler, response, chat_data
        )
        super().__init__(content=content)

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
    def content_generator(
        self,
        request: Request,
        chat_data: ChatData,
        event_handler: AgentRunResult | AsyncGenerator,
        events: AsyncGenerator[AgentRunEvent, None],
        verbose: bool = True,
    ):
        # Yield the text response
        async def _chat_response_generator():
            result = await event_handler
            final_response = ""

            if isinstance(result, AgentRunResult):
                for token in result.response.message.content:
                    final_response += token
                    yield self.convert_text(token)

            if isinstance(result, AsyncGenerator):
                async for token in result:
                    final_response += token.delta
                    yield self.convert_text(token.delta)

            # Generate next questions if next question prompt is configured
            question_data = await self._generate_next_questions(
                chat_data.messages, final_response
            )
            if question_data:
                yield self.convert_data(question_data)

            # TODO: stream sources

        # Yield the events from the event handler
        async def _event_generator():
            async for event in events:
                event_response = self._event_to_response(event)
                if verbose:
                    logger.debug(event_response)
                if event_response is not None:
                    yield self.convert_data(event_response)

        combine = stream.merge(_chat_response_generator(), _event_generator())
        return combine

    @staticmethod
    def _event_to_response(event: AgentRunEvent) -> dict:
        return {
            "type": "agent",
            "data": {"agent": event.name, "text": event.msg},
        }

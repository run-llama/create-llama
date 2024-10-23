import asyncio
import json
import logging
from typing import AsyncGenerator, List

from aiostream import stream
from app.api.routers.models import ChatData, Message
from app.api.services.suggestion import NextQuestionSuggestion
from app.workflows.single import AgentRunEvent, AgentRunResult
from fastapi import Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger("uvicorn")


class VercelStreamResponse(StreamingResponse):
    """
    Base class to convert the response from the chat engine to the streaming format expected by Vercel
    """

    TEXT_PREFIX = "0:"
    DATA_PREFIX = "8:"

    def __init__(self, request: Request, chat_data: ChatData, *args, **kwargs):
        self.request = request
        self.chat_data = chat_data
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
            logger.info("Stopping workflow")
            await event_handler.cancel_run()
        except Exception as e:
            logger.error(
                f"Unexpected error in content_generator: {str(e)}", exc_info=True
            )
        finally:
            logger.info("The stream has been stopped!")

    def _create_stream(
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

    @classmethod
    def convert_text(cls, token: str):
        # Escape newlines and double quotes to avoid breaking the stream
        token = json.dumps(token)
        return f"{cls.TEXT_PREFIX}{token}\n"

    @classmethod
    def convert_data(cls, data: dict):
        data_str = json.dumps(data)
        return f"{cls.DATA_PREFIX}[{data_str}]\n"

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

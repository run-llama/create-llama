import logging
from typing import Any

from app.api.callbacks.base import EventCallback
from app.api.routers.models import ChatData
from app.api.services.suggestion import NextQuestionSuggestion

logger = logging.getLogger("uvicorn")


class SuggestNextQuestions(EventCallback):
    """Processor for generating next question suggestions."""

    def __init__(self, chat_data: ChatData):
        self.chat_data = chat_data
        self.accumulated_text = ""

    async def on_complete(self, final_response: str) -> Any:
        if final_response == "":
            return None

        questions = await NextQuestionSuggestion.suggest_next_questions(
            self.chat_data.messages, final_response
        )
        if questions:
            return {
                "type": "suggested_questions",
                "data": questions,
            }
        return None

    @classmethod
    def from_default(cls, chat_data: ChatData) -> "SuggestNextQuestions":
        return cls(chat_data=chat_data)

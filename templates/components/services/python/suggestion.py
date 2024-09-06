import logging
import os
from typing import List, Optional

from app.api.routers.models import Message
from llama_index.core.prompts import PromptTemplate
from llama_index.core.settings import Settings
from pydantic import BaseModel

logger = logging.getLogger("uvicorn")


class NextQuestions(BaseModel):
    """A list of questions that user might ask next"""

    questions: List[str]


class NextQuestionSuggestion:

    @classmethod
    def get_configured_prompt(cls) -> Optional[str]:
        return os.getenv("NEXT_QUESTION_PROMPT", None)

    @classmethod
    async def suggest_next_questions(
        cls,
        messages: List[Message],
    ) -> Optional[List[str]]:
        """
        Suggest the next questions that user might ask based on the conversation history
        Return None if suggestion is disabled or there is an error
        """
        prompt_template = cls.get_configured_prompt()
        if not prompt_template:
            return None

        try:
            # Reduce the cost by only using the last two messages
            last_user_message = None
            last_assistant_message = None
            for message in reversed(messages):
                if message.role == "user":
                    last_user_message = f"User: {message.content}"
                elif message.role == "assistant":
                    last_assistant_message = f"Assistant: {message.content}"
                if last_user_message and last_assistant_message:
                    break
            conversation: str = f"{last_user_message}\n{last_assistant_message}"

            output: NextQuestions = await Settings.llm.astructured_predict(
                NextQuestions,
                prompt=PromptTemplate(prompt_template),
                conversation=conversation,
            )

            return output.questions
        except Exception as e:
            logger.error(f"Error when generating next question: {e}")
            return None

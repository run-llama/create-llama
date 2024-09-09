import logging
import os
import re
from typing import List, Optional

from app.api.routers.models import Message
from llama_index.core.prompts import PromptTemplate
from llama_index.core.settings import Settings

logger = logging.getLogger("uvicorn")


class NextQuestionSuggestion:
    """
    Suggest the next questions that user might ask based on the conversation history
    Disable this feature by removing the NEXT_QUESTION_PROMPT environment variable
    """

    @classmethod
    def get_configured_prompt(cls) -> Optional[str]:
        prompt = os.getenv("NEXT_QUESTION_PROMPT", None)
        if not prompt:
            return None
        return PromptTemplate(prompt)

    @classmethod
    async def suggest_next_questions_all_messages(
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

            # Call the LLM and parse questions from the output
            prompt = prompt_template.format(conversation=conversation)
            output = await Settings.llm.acomplete(prompt)
            questions = cls._extract_questions(output.text)

            return questions
        except Exception as e:
            logger.error(f"Error when generating next question: {e}")
            return None

    @classmethod
    def _extract_questions(cls, text: str) -> List[str]:
        content_match = re.search(r"```(.*?)```", text, re.DOTALL)
        content = content_match.group(1) if content_match else ""
        return content.strip().split("\n")

    @classmethod
    async def suggest_next_questions(
        cls,
        chat_history: List[Message],
        response: str,
    ) -> List[str]:
        """
        Suggest the next questions that user might ask based on the chat history and the last response
        """
        messages = chat_history + [Message(role="assistant", content=response)]
        return await cls.suggest_next_questions_all_messages(messages)

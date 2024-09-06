import logging
from typing import List, Optional

from llama_index.core.prompts import PromptTemplate
from llama_index.core.settings import Settings
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.api.routers.models import Message

logger = logging.getLogger("uvicorn")


class NextQuestionSettings(BaseSettings):
    enable: bool = True
    prompt_template: str = (
        "You're a helpful assistant! Your task is to suggest the next question that user might ask. "
        "\nHere is the conversation history"
        "\n---------------------\n{conversation}\n---------------------"
        "Given the conversation history, please give me 3 questions that you might ask next!"
    )

    model_config = SettingsConfigDict(env_prefix="NEXT_QUESTION_")

    @property
    def prompt(self) -> PromptTemplate:
        return PromptTemplate(self.prompt_template)


next_question_settings = NextQuestionSettings()


class NextQuestions(BaseModel):
    """A list of questions that user might ask next"""

    questions: List[str]


class NextQuestionSuggestion:
    @staticmethod
    async def suggest_next_questions(
        messages: List[Message],
    ) -> Optional[List[str]]:
        """
        Suggest the next questions that user might ask based on the conversation history
        Return None if suggestion is disabled or there is an error
        """
        if not next_question_settings.enable:
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
                prompt=next_question_settings.prompt,
                conversation=conversation,
            )

            return output.questions
        except Exception as e:
            logger.error(f"Error when generating next question: {e}")
            return None

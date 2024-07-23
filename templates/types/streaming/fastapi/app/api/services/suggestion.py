from typing import List

from app.api.routers.models import Message
from llama_index.core.prompts import PromptTemplate
from llama_index.core.settings import Settings
from pydantic import BaseModel

NEXT_QUESTIONS_SUGGESTION_PROMPT = PromptTemplate(
    "You're a helpful assistant! Your task is to suggest the next question that user might ask. "
    "\nHere is the conversation history"
    "\n---------------------\n{conversation}\n---------------------"
    "Given the conversation history, please give me $number_of_questions questions that you might ask next!"
)
N_QUESTION_TO_GENERATE = 3


class NextQuestions(BaseModel):
    """A list of questions that user might ask next"""

    questions: List[str]


class NextQuestionSuggestion:
    @staticmethod
    async def suggest_next_questions(
        messages: List[Message],
        number_of_questions: int = N_QUESTION_TO_GENERATE,
    ) -> List[str]:
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
            prompt=NEXT_QUESTIONS_SUGGESTION_PROMPT,
            conversation=conversation,
            nun_questions=number_of_questions,
        )

        return output.questions

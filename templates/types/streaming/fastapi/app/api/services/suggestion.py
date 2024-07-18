import re
from string import Template
from typing import List

from app.api.routers.models import Message
from llama_index.core.settings import Settings

NEXT_QUESTIONS_SUGGESTION_TPL = Template(
    "You're a helpful assistant! Your task is to suggest the next question that user might ask. "
    "\nHere is the conversation history"
    "\n---------------------\n$conversation\n---------------------"
    "Given the conversation history, please give me $number_of_questions questions that you might ask next!"
    "Your answer should be wrapped in three sticks which follows the following format:"
    "\n```\n<question 1>\n<question 2>```"
)


class NextQuestionSuggestion:
    @staticmethod
    def _extract_questions(text):
        # Extract the text inside the triple backticks
        content = re.search(r"```(.*?)```", text, re.DOTALL).group(1)

        # Regex pattern to match each question
        pattern = r"\d+\.\s(.*?)(?=\n\d+\.|$)"

        # Find all matches in the content
        questions = re.findall(pattern, content, re.DOTALL)

        return questions

    @staticmethod
    async def suggest_next_questions(
        messages: List[Message],
        number_of_questions: int = 3,
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

        llm = Settings.llm

        prompt = NEXT_QUESTIONS_SUGGESTION_TPL.substitute(
            conversation=conversation, number_of_questions=number_of_questions
        )

        response = await llm.acomplete(prompt=prompt)

        questions = NextQuestionSuggestion._extract_questions(response.text)

        return questions

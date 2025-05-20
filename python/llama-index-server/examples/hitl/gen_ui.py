import asyncio
from typing import Literal

from pydantic import BaseModel, Field

from llama_index.llms.openai import OpenAI
from llama_index.server.gen_ui import generate_event_component


class InputRequiredEvent(BaseModel):
    """InputRequiredEvent is sent when LLM needs to ask for input from the human. Should showed as a small box in the UI (not a dialog)"""

    prefix: str = Field(
        description="The prefix and description of the input that is required."
    )


class HumanInputEvent(BaseModel):
    """
    Event for asking for input from the human.
    """

    type: Literal["human"]
    data: InputRequiredEvent


if __name__ == "__main__":
    code = asyncio.run(
        generate_event_component(
            event_cls=InputRequiredEvent,
            llm=OpenAI(model="gpt-4.1"),
        )
    )
    print(code)

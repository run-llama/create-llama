from typing import Optional

from fastapi import FastAPI

from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.workflow import Context, HumanResponseEvent, InputRequiredEvent
from llama_index.llms.openai import OpenAI
from llama_index.server import LlamaIndexServer, UIConfig
from llama_index.server.api.models import ChatRequest


async def ask_city(ctx: Context) -> str:
    """
    Get the city from the user
    """
    question = "Where is your place now?"
    event = await ctx.wait_for_event(
        HumanResponseEvent,
        waiter_id=question,
        waiter_event=InputRequiredEvent(  # type: ignore
            prefix=question,
        ),
    )
    return event.response


async def get_weather(city: str) -> str:
    """
    Get the weather of the city
    """
    return f"The weather of {city} is sunny."


def create_workflow(chat_request: Optional[ChatRequest] = None) -> AgentWorkflow:
    return AgentWorkflow.from_tools_or_functions(
        tools_or_functions=[ask_city, get_weather],
        llm=OpenAI(model="gpt-4.1-mini"),
        system_prompt="You are a helpful assistant. Use the provided tools to answer the user's question.",
    )


def create_app() -> FastAPI:
    app = LlamaIndexServer(
        workflow_factory=create_workflow,
        ui_config=UIConfig(
            app_title="Artifact",
            starter_questions=[
                "What is the weather now?",
                "May I play golf today?",
            ],
        ),
    )
    return app


# Run command: `uv run fastapi dev`
app = create_app()

import logging
from typing import AsyncGenerator, Callable
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from llama_index.core.workflow import StopEvent, Workflow
from llama_index.core.workflow.handler import WorkflowHandler
from llama_index.server.api.models import ChatAPIMessage, ChatRequest, MessageRole
from llama_index.server.api.routers.chat import chat_router


@pytest.fixture()
def logger() -> logging.Logger:
    return logging.getLogger("test")


@pytest.fixture()
def chat_request() -> ChatRequest:
    """Create a simple chat request with one user message."""
    return ChatRequest(
        id="test",
        messages=[ChatAPIMessage(role=MessageRole.USER, content="Hello, how are you?")],
    )


@pytest.fixture()
def mock_workflow() -> MagicMock:
    """Create a mock workflow that returns a simple response."""
    workflow = MagicMock(spec=Workflow)
    handler = AsyncMock(spec=WorkflowHandler)

    # Setup the handler to stream a simple response event
    async def mock_stream_events() -> AsyncGenerator[StopEvent, None]:
        yield StopEvent(result="I'm doing well, thank you for asking!")

    handler.stream_events.return_value = mock_stream_events()
    workflow.run.return_value = handler

    return workflow


@pytest.fixture()
def workflow_factory(mock_workflow: MagicMock) -> Callable[[], MagicMock]:
    """Create a factory function that returns our mock workflow."""

    def factory(verbose: bool = False) -> MagicMock:
        return mock_workflow

    return factory


@pytest.mark.asyncio()
async def test_chat_router(
    chat_request: ChatRequest,
    workflow_factory: Callable[[], MagicMock],
    logger: logging.Logger,
) -> None:
    """Test that the chat router handles a request correctly."""
    # Create a FastAPI app and mount our router
    app = FastAPI()
    router = chat_router(workflow_factory, logger)
    app.include_router(router)

    # Make a request to the chat endpoint
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/chat", json=chat_request.model_dump())

        # Check response status
        assert response.status_code == 200

        # For streaming responses we don't check the content-type header directly
        # Instead, check that we get the expected content in the response body

        # The response is a stream, so we need to collect the chunks
        content = response.content.decode()

        # Verify content structure follows expected format
        assert "0:" in content  # Text prefix for VercelStreamResponse
        # Verify if the response contains the expected message
        assert "I'm doing well" in content

        # Verify the mock workflow was called correctly
        mock_workflow = workflow_factory()
        mock_workflow.run.assert_called_once()

        # Verify the workflow was called with the correct arguments
        call_args = mock_workflow.run.call_args[1]
        assert call_args["user_msg"] == "Hello, how are you?"
        assert isinstance(call_args["chat_history"], list)
        assert len(call_args["chat_history"]) == 0  # No history for first message


@pytest.mark.asyncio()
async def test_chat_with_agent_workflow(logger: logging.Logger) -> None:
    """Test that the chat router works with a workflow that mimics an agent workflow."""
    # Create a simple workflow that mimics an agent workflow
    mock_workflow = MagicMock(spec=Workflow)
    handler = AsyncMock(spec=WorkflowHandler)

    # Setup the handler to stream a simple response about weather
    async def mock_stream_events() -> AsyncGenerator[StopEvent, None]:
        yield StopEvent(
            result="The weather in New York is sunny. I used the weather tool to get this information."
        )

    handler.stream_events.return_value = mock_stream_events()
    mock_workflow.run.return_value = handler

    # Create a factory function that returns our mock workflow
    def workflow_factory(verbose: bool = False) -> MagicMock:
        return mock_workflow

    # Create a FastAPI app and mount our router
    app = FastAPI()
    router = chat_router(workflow_factory, logger)
    app.include_router(router)

    # Create a chat request asking about weather
    chat_request = ChatRequest(
        id="test",
        messages=[
            ChatAPIMessage(
                role=MessageRole.USER, content="What's the weather in New York?"
            )
        ],
    )

    # Make a request to the chat endpoint
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/chat", json=chat_request.model_dump())

        # Check response status
        assert response.status_code == 200

        # The response is a stream, so we need to collect the chunks
        content = response.content.decode()

        # Verify content structure follows expected format
        assert "0:" in content  # Text prefix for VercelStreamResponse

        # Verify the response content contains expected keywords
        assert "weather" in content and "New York" in content and "sunny" in content

        # Verify the mock workflow was called correctly
        mock_workflow.run.assert_called_once()

        # Verify the workflow was called with the correct arguments
        call_args = mock_workflow.run.call_args[1]
        assert call_args["user_msg"] == "What's the weather in New York?"
        assert isinstance(call_args["chat_history"], list)
        assert len(call_args["chat_history"]) == 0  # No history for first message

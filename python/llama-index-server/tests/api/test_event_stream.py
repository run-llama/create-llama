import asyncio
import logging
from typing import Any, AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest

from llama_index.core.agent.workflow.workflow_events import AgentStream
from llama_index.core.types import MessageRole
from llama_index.core.workflow import StopEvent
from llama_index.core.workflow.handler import WorkflowHandler
from llama_index.server.api.models import ChatAPIMessage, ChatRequest
from llama_index.server.api.routers.chat import _stream_content
from llama_index.server.api.utils.vercel_stream import VercelStreamResponse


@pytest.fixture()
def logger() -> logging.Logger:
    return logging.getLogger("test")


@pytest.fixture()
def chat_request() -> ChatRequest:
    return ChatRequest(
        messages=[ChatAPIMessage(role=MessageRole.USER, content="test message")]
    )


@pytest.fixture()
def mock_workflow_handler() -> AsyncMock:
    handler = AsyncMock(spec=WorkflowHandler)
    handler.accumulate_text = MagicMock()
    return handler


class TestEventStream:
    @pytest.mark.asyncio()
    async def test_stream_content_with_agent_stream(
        self,
        mock_workflow_handler: AsyncMock,
        chat_request: ChatRequest,
        logger: logging.Logger,
    ) -> None:
        # Setup
        mock_workflow_handler.stream_events.return_value = (
            self._mock_agent_stream_events()
        )

        # Execute
        result = [
            chunk
            async for chunk in _stream_content(
                mock_workflow_handler, chat_request, logger
            )
        ]

        # Assert
        assert len(result) == 2
        assert result[0] == VercelStreamResponse.convert_text("Hello")
        assert result[1] == VercelStreamResponse.convert_text(" World")

    @pytest.mark.asyncio()
    async def test_stream_content_with_stop_event_string(
        self,
        mock_workflow_handler: AsyncMock,
        chat_request: ChatRequest,
        logger: logging.Logger,
    ) -> None:
        # Setup
        mock_workflow_handler.stream_events.return_value = (
            self._mock_stop_event_string()
        )

        # Execute
        result = [
            chunk
            async for chunk in _stream_content(
                mock_workflow_handler, chat_request, logger
            )
        ]

        # Assert
        assert len(result) == 1
        assert result[0] == VercelStreamResponse.convert_text("Final answer")

    @pytest.mark.asyncio()
    async def test_stream_content_with_stop_event_delta_objects(
        self,
        mock_workflow_handler: AsyncMock,
        chat_request: ChatRequest,
        logger: logging.Logger,
    ) -> None:
        # Setup
        mock_workflow_handler.stream_events.return_value = (
            self._mock_stop_event_delta_objects()
        )

        # Execute
        result = [
            chunk
            async for chunk in _stream_content(
                mock_workflow_handler, chat_request, logger
            )
        ]

        # Assert
        assert len(result) == 2
        assert result[0] == VercelStreamResponse.convert_text("Delta 1")
        assert result[1] == VercelStreamResponse.convert_text("Delta 2")

    @pytest.mark.asyncio()
    async def test_stream_content_with_event_with_to_response(
        self,
        mock_workflow_handler: AsyncMock,
        chat_request: ChatRequest,
        logger: logging.Logger,
    ) -> None:
        # Setup
        mock_workflow_handler.stream_events.return_value = (
            self._mock_event_with_to_response()
        )

        # Execute
        result = [
            chunk
            async for chunk in _stream_content(
                mock_workflow_handler, chat_request, logger
            )
        ]

        # Assert
        assert len(result) == 1
        assert result[0] == VercelStreamResponse.convert_data({"event_type": "test"})

    @pytest.mark.asyncio()
    async def test_stream_content_with_event_with_model_dump(
        self,
        mock_workflow_handler: AsyncMock,
        chat_request: ChatRequest,
        logger: logging.Logger,
    ) -> None:
        # Setup
        mock_workflow_handler.stream_events.return_value = (
            self._mock_event_with_model_dump()
        )

        # Execute
        result = [
            chunk
            async for chunk in _stream_content(
                mock_workflow_handler, chat_request, logger
            )
        ]

        # Assert
        assert len(result) == 1
        assert result[0] == VercelStreamResponse.convert_data(None)  # type: ignore

    @pytest.mark.asyncio()
    async def test_stream_content_with_cancelled_error(
        self,
        mock_workflow_handler: AsyncMock,
        chat_request: ChatRequest,
        logger: logging.Logger,
    ) -> None:
        # Setup
        mock_workflow_handler.stream_events.side_effect = asyncio.CancelledError()
        logger.warning = MagicMock()  # type: ignore

        # Execute
        result = [
            chunk
            async for chunk in _stream_content(
                mock_workflow_handler, chat_request, logger
            )
        ]

        # Assert
        assert len(result) == 0
        mock_workflow_handler.cancel_run.assert_called_once()
        logger.warning.assert_called_once()

    @pytest.mark.asyncio()
    async def test_stream_content_with_exception(
        self,
        mock_workflow_handler: AsyncMock,
        chat_request: ChatRequest,
        logger: logging.Logger,
    ) -> None:
        # Setup
        error_message = "Test error"
        mock_workflow_handler.stream_events.side_effect = Exception(error_message)
        logger.error = MagicMock()  # type: ignore

        # Execute
        result = [
            chunk
            async for chunk in _stream_content(
                mock_workflow_handler, chat_request, logger
            )
        ]

        # Assert
        assert len(result) == 1
        assert result[0] == VercelStreamResponse.convert_error(error_message)
        mock_workflow_handler.cancel_run.assert_called_once()
        logger.error.assert_called_once()

    async def _mock_agent_stream_events(self) -> AsyncGenerator[AgentStream, Any]:
        yield AgentStream(
            delta="Hello", response="", current_agent_name="", tool_calls=[], raw=""
        )
        yield AgentStream(
            delta=" World", response="", current_agent_name="", tool_calls=[], raw=""
        )

    async def _mock_agent_stream_with_empty_deltas(
        self,
    ) -> AsyncGenerator[AgentStream, Any]:
        yield AgentStream(
            delta="   ",  # Empty delta with spaces - should be filtered
            response="",
            current_agent_name="",
            tool_calls=[],
            raw="",
        )
        yield AgentStream(
            delta="Valid delta",
            response="",
            current_agent_name="",
            tool_calls=[],
            raw="",
        )
        yield AgentStream(
            delta="\n",  # Newline-only delta - should be filtered
            response="",
            current_agent_name="",
            tool_calls=[],
            raw="",
        )

    async def _mock_stop_event_string(self) -> AsyncGenerator[StopEvent, Any]:
        yield StopEvent(result="Final answer")

    async def _mock_stop_event_delta_objects(self) -> AsyncGenerator[StopEvent, Any]:
        async def generator() -> AsyncGenerator[Any, Any]:
            # Create proper objects with delta attribute that can be serialized
            class ObjectWithDelta:
                def __init__(self, delta_value: str) -> None:
                    self.delta = delta_value

            yield ObjectWithDelta("Delta 1")
            yield ObjectWithDelta("Delta 2")

        yield StopEvent(result=generator())

    async def _mock_dict_event(self) -> AsyncGenerator[dict[Any, Any], Any]:
        yield {"key": "value"}

    async def _mock_event_with_to_response(self) -> AsyncGenerator[Any, Any]:
        event = MagicMock()
        event.to_response.return_value = {"event_type": "test"}
        yield event

    async def _mock_event_with_model_dump(self) -> AsyncGenerator[Any, Any]:
        event = MagicMock()
        event.model_dump.return_value = {"name": "test_event"}
        # Override to_response to return None - this means convert_data(None) will be called
        event.to_response = MagicMock(return_value=None)
        # The model_dump value is ignored when to_response returns None
        yield event

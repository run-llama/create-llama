import asyncio
import inspect
import logging
import os
from typing import AsyncGenerator, Callable, Union

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse

from llama_index.core.agent.workflow.workflow_events import (
    AgentInput,
    AgentSetup,
    AgentStream,
)
from llama_index.core.workflow import StopEvent, Workflow
from llama_index.server.api.callbacks import (
    EventCallback,
    LlamaCloudFileDownload,
    SourceNodesFromToolCall,
    SuggestNextQuestions,
)
from llama_index.server.api.callbacks.stream_handler import StreamHandler
from llama_index.server.api.models import ChatRequest
from llama_index.server.api.utils.vercel_stream import VercelStreamResponse
from llama_index.server.services.llamacloud import LlamaCloudFileService


def chat_router(
    workflow_factory: Callable[..., Workflow],
    logger: logging.Logger,
) -> APIRouter:
    router = APIRouter(prefix="/chat")

    @router.post("")
    async def chat(
        request: ChatRequest,
        background_tasks: BackgroundTasks,
    ) -> StreamingResponse:
        try:
            user_message = request.messages[-1].to_llamaindex_message()
            chat_history = [
                message.to_llamaindex_message() for message in request.messages[:-1]
            ]
            # detect if the workflow factory has chat_request as a parameter
            factory_sig = inspect.signature(workflow_factory)
            if "chat_request" in factory_sig.parameters:
                workflow = workflow_factory(chat_request=request)
            else:
                workflow = workflow_factory()
            workflow_handler = workflow.run(
                user_msg=user_message.content,
                chat_history=chat_history,
            )

            callbacks: list[EventCallback] = [
                SourceNodesFromToolCall(),
                LlamaCloudFileDownload(background_tasks),
            ]
            if request.config and request.config.next_question_suggestions:
                callbacks.append(SuggestNextQuestions(request))
            stream_handler = StreamHandler(
                workflow_handler=workflow_handler,
                callbacks=callbacks,
            )

            return VercelStreamResponse(
                content_generator=_stream_content(stream_handler, request, logger),
            )
        except Exception as e:
            logger.error(e)
            raise HTTPException(status_code=500, detail=str(e))

    if LlamaCloudFileService.is_configured():

        @router.get("/config/llamacloud")
        async def chat_llama_cloud_config() -> dict:
            if not os.getenv("LLAMA_CLOUD_API_KEY"):
                raise HTTPException(
                    status_code=500, detail="LlamaCloud API KEY is not configured"
                )
            projects = LlamaCloudFileService.get_all_projects_with_pipelines()
            pipeline = os.getenv("LLAMA_CLOUD_INDEX_NAME")
            project = os.getenv("LLAMA_CLOUD_PROJECT_NAME")
            pipeline_config = None
            if pipeline and project:
                pipeline_config = {
                    "pipeline": pipeline,
                    "project": project,
                }
            return {
                "projects": projects,
                "pipeline": pipeline_config,
            }

    return router


async def _stream_content(
    handler: StreamHandler,
    request: ChatRequest,
    logger: logging.Logger,
) -> AsyncGenerator[str, None]:
    async def _text_stream(
        event: Union[AgentStream, StopEvent],
    ) -> AsyncGenerator[str, None]:
        if isinstance(event, AgentStream):
            # Normally, if the stream is a tool call, the delta is always empty
            # so it's not a text stream.
            if len(event.tool_calls) == 0:
                yield event.delta
        elif isinstance(event, StopEvent):
            if isinstance(event.result, str):
                yield event.result
            elif isinstance(event.result, AsyncGenerator):
                async for chunk in event.result:
                    if isinstance(chunk, str):
                        yield chunk
                    elif hasattr(chunk, "delta") and chunk.delta:
                        yield chunk.delta

    try:
        async for event in handler.stream_events():
            if isinstance(event, (AgentStream, StopEvent)):
                async for chunk in _text_stream(event):
                    handler.accumulate_text(chunk)
                    yield VercelStreamResponse.convert_text(chunk)
            elif isinstance(event, dict):
                yield VercelStreamResponse.convert_data(event)
            elif hasattr(event, "to_response"):
                event_response = event.to_response()
                yield VercelStreamResponse.convert_data(event_response)
            else:
                # Ignore unnecessary agent workflow events
                if not isinstance(event, (AgentInput, AgentSetup)):
                    yield VercelStreamResponse.convert_data(event.model_dump())

    except asyncio.CancelledError:
        logger.warning("Client cancelled the request!")
        await handler.cancel_run()
    except Exception as e:
        logger.error(f"Error in stream response: {e}", exc_info=True)
        yield VercelStreamResponse.convert_error(str(e))
        await handler.cancel_run()

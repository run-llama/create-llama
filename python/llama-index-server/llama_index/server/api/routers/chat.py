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
from llama_index.core.workflow import (
    StopEvent,
    Workflow,
)
from llama_index.server.api.callbacks import (
    AgentCallTool,
    EventCallback,
    InlineAnnotationTransformer,
    LlamaCloudFileDownload,
    SourceNodesFromToolCall,
    SuggestNextQuestions,
)
from llama_index.server.api.callbacks.stream_handler import StreamHandler
from llama_index.server.api.utils.vercel_stream import VercelStreamResponse
from llama_index.server.models.chat import (
    ChatRequest,
    FileUpload,
    MessageRole,
)
from llama_index.server.models.file import ServerFileResponse
from llama_index.server.models.hitl import HumanInputEvent
from llama_index.server.services.file import FileService
from llama_index.server.services.llamacloud import LlamaCloudFileService
from llama_index.server.services.workflow import HITLWorkflowService
from pydantic_core import PydanticSerializationError


def chat_router(
    workflow_factory: Callable[..., Workflow],
    logger: logging.Logger,
    suggest_next_questions: bool = True,
) -> APIRouter:
    router = APIRouter(prefix="/chat")

    @router.post("")
    async def chat(
        request: ChatRequest,
        background_tasks: BackgroundTasks,
    ) -> StreamingResponse:
        try:
            last_message = request.messages[-1]
            if last_message.role != MessageRole.USER:
                raise ValueError("Last message must be from user")
            chat_history = [
                message.to_llamaindex_message() for message in request.messages[:-1]
            ]
            # detect if the workflow factory has chat_request as a parameter
            factory_sig = inspect.signature(workflow_factory)
            if "chat_request" in factory_sig.parameters:
                workflow = workflow_factory(chat_request=request)
            else:
                workflow = workflow_factory()

            # Check if we should resume a chat with a human response
            human_response = last_message.human_response
            if human_response:
                ctx = await HITLWorkflowService.load_context(
                    id=request.id,
                    workflow=workflow,
                    data=human_response,
                )
                workflow_handler = workflow.run(ctx=ctx)
            else:
                workflow_handler = workflow.run(
                    user_msg=last_message.content,
                    chat_history=chat_history,
                )

            callbacks: list[EventCallback] = [
                AgentCallTool(),
                InlineAnnotationTransformer(),
                SourceNodesFromToolCall(),
                LlamaCloudFileDownload(background_tasks),
            ]
            if suggest_next_questions:
                callbacks.append(SuggestNextQuestions(request))
            stream_handler = StreamHandler(
                workflow_handler=workflow_handler,
                callbacks=callbacks,
            )

            return VercelStreamResponse(
                content_generator=_stream_content(
                    stream_handler,
                    logger,
                    request.id,
                ),
            )
        except Exception as e:
            logger.error(e)
            raise HTTPException(status_code=500, detail=str(e))

    # we just simply save the file to the server and don't index it
    @router.post("/file")
    async def upload_file(request: FileUpload) -> ServerFileResponse:
        """
        Upload a file to the server to be used in the chat session.
        """
        try:
            save_dir = os.path.join("output", "private")
            content, _ = FileService._preprocess_base64_file(request.base64)
            file = FileService.save_file(content, request.name, save_dir)
            return file.to_server_file_response()
        except Exception:
            raise HTTPException(status_code=500, detail="Error uploading file")

    # Specific to LlamaCloud
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
    logger: logging.Logger,
    chat_id: str,
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
            elif isinstance(event, HumanInputEvent):
                ctx = handler.workflow_handler.ctx
                if ctx is None:
                    raise RuntimeError("Context is None")
                # Save the context with the HITL event
                await HITLWorkflowService.save_context(
                    id=chat_id,
                    ctx=ctx,
                    resume_event_type=event.response_event_type,
                )
                yield VercelStreamResponse.convert_data(event.to_response())
                # return to stop the stream
                return
            elif isinstance(event, dict):
                yield VercelStreamResponse.convert_data(event)
            elif hasattr(event, "to_response"):
                event_response = event.to_response()
                yield VercelStreamResponse.convert_data(event_response)
            else:
                # Ignore unnecessary agent workflow events
                if not isinstance(event, (AgentInput, AgentSetup)):
                    try:
                        yield VercelStreamResponse.convert_data(event.model_dump())
                    except PydanticSerializationError:
                        logger.warning(f"Error serializing event: {event}")
                        # Skip events that can't be serialized
                        pass

        await handler.wait_for_completion()
    except asyncio.CancelledError:
        logger.warning("Client cancelled the request!")
        await handler.cancel_run()
    except Exception as e:
        logger.error(f"Error in stream response: {e}", exc_info=True)
        yield VercelStreamResponse.convert_error(str(e))
        await handler.cancel_run()

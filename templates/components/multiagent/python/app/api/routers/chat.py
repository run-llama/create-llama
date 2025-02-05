import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status

from app.api.callbacks.llamacloud import LlamaCloudFileDownload
from app.api.callbacks.next_question import SuggestNextQuestions
from app.api.callbacks.stream_handler import StreamHandler
from app.api.routers.models import (
    ChatData,
)
from app.engine.query_filter import generate_filters
from app.workflows import create_workflow

chat_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


@r.post("")
async def chat(
    request: Request,
    data: ChatData,
    background_tasks: BackgroundTasks,
):
    try:
        last_message_content = data.get_last_message_content()
        messages = data.get_history_messages(include_agent_messages=True)

        doc_ids = data.get_chat_document_ids()
        filters = generate_filters(doc_ids)
        params = data.data or {}

        workflow = create_workflow(
            params=params,
            filters=filters,
        )

        handler = workflow.run(
            user_msg=last_message_content,
            chat_history=messages,
            stream=True,
        )
        return StreamHandler.from_default(
            handler=handler,
            callbacks=[
                LlamaCloudFileDownload.from_default(background_tasks),
                SuggestNextQuestions.from_default(data),
            ],
        ).vercel_stream()
    except Exception as e:
        logger.exception("Error in chat engine", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in chat engine: {e}",
        ) from e

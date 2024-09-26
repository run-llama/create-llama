import logging

from app.api.routers.models import (
    ChatData,
)
from app.api.routers.vercel_response import VercelStreamResponse
from app.examples.factory import create_agent
from fastapi import APIRouter, HTTPException, Request, status
from llama_index.core.workflow import Workflow

chat_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


@r.post("")
async def chat(
    request: Request,
    data: ChatData,
):
    try:
        last_message_content = data.get_last_message_content()
        messages = data.get_history_messages()
        # TODO: generate filters based on doc_ids
        # for now just use all documents
        # doc_ids = data.get_chat_document_ids()
        # TODO: use params
        # params = data.data or {}

        agent: Workflow = create_agent(chat_history=messages)
        handler = agent.run(input=last_message_content, streaming=True)

        return VercelStreamResponse(request, handler, agent.stream_events, data)
    except Exception as e:
        logger.exception("Error in agent", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in agent: {e}",
        ) from e

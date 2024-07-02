import os
import logging
import asyncio

from aiostream import stream
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from llama_index.core.chat_engine.types import BaseChatEngine
from llama_index.core.llms import MessageRole
from app.engine import get_chat_engine
from app.api.routers.vercel_response import VercelStreamResponse
from app.api.routers.events import EventCallbackHandler
from app.api.routers.models import (
    ChatData,
    ChatConfig,
    SourceNodes,
    Result,
    Message,
)
from app.engine.agent_launcher import LocalLauncher, get_launcher

chat_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


@r.post("")
async def chat(
    request: Request,
    data: ChatData,
    agent_launcher: LocalLauncher = Depends(get_launcher),
):
    try:
        last_message_content = data.get_last_message_content()
        messages = data.get_history_messages()

        result = await agent_launcher.alaunch_single(last_message_content)
        return VercelStreamResponse(content=[VercelStreamResponse.convert_text(result)])

    except Exception as e:
        logger.exception("Error in chat engine", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(e)})


# non-streaming endpoint - delete if not needed
@r.post("/request")
async def chat_request(
    data: ChatData,
    chat_engine: BaseChatEngine = Depends(get_chat_engine),
) -> Result:
    try:
        last_message_content = data.get_last_message_content()
        messages = data.get_history_messages()

        result = await agent_launcher.alaunch_single(last_message_content)
        return Result(
            result=Message(role=MessageRole.ASSISTANT, content=result),
            nodes=[],
        )
    except Exception as e:
        logger.exception("Error in chat engine", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in chat engine: {e}",
        ) from e


@r.get("/config")
async def chat_config() -> ChatConfig:
    starter_questions = None
    conversation_starters = os.getenv("CONVERSATION_STARTERS")
    if conversation_starters and conversation_starters.strip():
        starter_questions = conversation_starters.strip().split("\n")
    return ChatConfig(starterQuestions=starter_questions)

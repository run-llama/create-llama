import json
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status
from llama_index.core.agent.workflow import AgentOutput
from llama_index.core.llms import MessageRole

from app.api.callbacks.llamacloud import LlamaCloudFileDownload
from app.api.callbacks.next_question import SuggestNextQuestions
from app.api.callbacks.source_nodes import AddNodeUrl
from app.api.callbacks.stream_handler import StreamHandler
from app.api.routers.models import (
    ChatData,
    Message,
    Result,
)
from app.engine.engine import get_engine
from app.engine.query_filter import generate_filters

chat_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


# streaming endpoint - delete if not needed
@r.post("")
async def chat(
    request: Request,
    data: ChatData,
    background_tasks: BackgroundTasks,
):
    try:
        last_message_content = data.get_last_message_content()
        messages = data.get_history_messages()

        doc_ids = data.get_chat_document_ids()
        filters = generate_filters(doc_ids)
        params = data.data or {}
        logger.info(
            f"Creating chat engine with filters: {str(filters)}",
        )
        engine = get_engine(filters=filters, params=params)
        handler = engine.run(
            user_msg=last_message_content,
            chat_history=messages,
            stream=True,
        )
        return StreamHandler.from_default(
            handler=handler,
            callbacks=[
                LlamaCloudFileDownload.from_default(background_tasks),
                SuggestNextQuestions.from_default(data),
                AddNodeUrl.from_default(),
            ],
        ).vercel_stream()
    except Exception as e:
        logger.exception("Error in chat engine", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in chat engine: {e}",
        ) from e


# non-streaming endpoint - delete if not needed
@r.post("/request")
async def chat_request(
    data: ChatData,
) -> Result:
    last_message_content = data.get_last_message_content()
    messages = data.get_history_messages()

    doc_ids = data.get_chat_document_ids()
    filters = generate_filters(doc_ids)
    params = data.data or {}
    logger.info(
        f"Creating chat engine with filters: {str(filters)}",
    )
    engine = get_engine(filters=filters, params=params)

    response = await engine.run(
        user_msg=last_message_content,
        chat_history=messages,
        stream=False,
    )
    output = response
    if isinstance(output, AgentOutput):
        content = output.response.content
    else:
        content = json.dumps(output)

    return Result(
        result=Message(role=MessageRole.ASSISTANT, content=content),
    )

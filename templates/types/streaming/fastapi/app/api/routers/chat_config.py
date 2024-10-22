import logging
import os

from fastapi import APIRouter, HTTPException

from app.api.routers.models import ChatConfig

config_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


def _is_llama_cloud_service_configured():
    try:
        from app.engine.service import (
            LLamaCloudFileService,  # type: ignore # noqa: F401
        )

        return True
    except ImportError:
        return False


async def chat_llama_cloud_config():
    from app.engine.service import LLamaCloudFileService  # type: ignore

    if not os.getenv("LLAMA_CLOUD_API_KEY"):
        raise HTTPException(
            status_code=500, detail="LlamaCloud API KEY is not configured"
        )
    projects = LLamaCloudFileService.get_all_projects_with_pipelines()
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


if _is_llama_cloud_service_configured():
    logger.info("LlamaCloud is configured. Adding /config/llamacloud route.")
    r.add_api_route("/llamacloud", chat_llama_cloud_config, methods=["GET"])


@r.get("")
async def chat_config() -> ChatConfig:
    starter_questions = None
    conversation_starters = os.getenv("CONVERSATION_STARTERS")
    if conversation_starters and conversation_starters.strip():
        starter_questions = conversation_starters.strip().split("\n")
    return ChatConfig(starter_questions=starter_questions)

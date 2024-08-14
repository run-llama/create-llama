import logging
import os

from fastapi import APIRouter

from app.api.routers.models import ChatConfig


config_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


@r.get("")
async def chat_config() -> ChatConfig:
    starter_questions = None
    conversation_starters = os.getenv("CONVERSATION_STARTERS")
    if conversation_starters and conversation_starters.strip():
        starter_questions = conversation_starters.strip().split("\n")
    return ChatConfig(starter_questions=starter_questions)


try:
    from app.engine.service import LLamaCloudFileService

    logger.info("LlamaCloud is configured. Adding /config/llamacloud route.")

    @r.get("/llamacloud")
    async def chat_llama_cloud_config():
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

except ImportError:
    logger.debug(
        "LlamaCloud is not configured. Skipping adding /config/llamacloud route."
    )
    pass

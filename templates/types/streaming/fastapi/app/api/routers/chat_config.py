import os

from fastapi import APIRouter

from app.api.routers.models import ChatConfig
from app.api.services.llama_cloud import LLamaCloudFileService

config_router = r = APIRouter()


@r.get("")
async def chat_config() -> ChatConfig:
    starter_questions = None
    conversation_starters = os.getenv("CONVERSATION_STARTERS")
    if conversation_starters and conversation_starters.strip():
        starter_questions = conversation_starters.strip().split("\n")
    return ChatConfig(starter_questions=starter_questions)


@r.get("/llamacloud")
async def chat_llama_cloud_config():
    projects = LLamaCloudFileService.get_all_projects_with_pipelines()
    pipeline = os.getenv("LLAMA_CLOUD_INDEX_NAME")
    project = os.getenv("LLAMA_CLOUD_PROJECT_NAME")
    pipeline_config = (
        pipeline
        and project
        and {
            "pipeline": pipeline,
            "project": project,
        }
        or None
    )
    return {
        "projects": projects,
        "pipeline": pipeline_config,
    }

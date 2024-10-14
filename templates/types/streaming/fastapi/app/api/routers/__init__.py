from fastapi import APIRouter

from .chat import chat_router  # noqa: F401
from .chat_config import config_router  # noqa: F401
from .upload import file_upload_router  # noqa: F401

api_router = APIRouter()
api_router.include_router(chat_router, prefix="/chat")
api_router.include_router(config_router, prefix="/chat/config")
api_router.include_router(file_upload_router, prefix="/chat/upload")

# Dynamically adding additional routers if they exist
try:
    from .sandbox import sandbox_router  # noqa: F401

    api_router.include_router(sandbox_router, prefix="/sandbox")
except ImportError:
    pass

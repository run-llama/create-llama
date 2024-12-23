from fastapi import APIRouter

from app.api.routers.download import router as download_router

api_router = APIRouter()

api_router.include_router(download_router, prefix="/api/download")

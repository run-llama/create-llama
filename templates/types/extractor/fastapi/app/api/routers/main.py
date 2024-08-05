from fastapi import APIRouter

from app.api.routers.extractor import extractor_router

api_router = APIRouter()

api_router.include_router(extractor_router, prefix="/api/extractor")

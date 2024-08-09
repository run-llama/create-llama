import logging

from fastapi import APIRouter

from app.models.request import RequestData
from app.services.extractor import ExtractorService

extractor_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


@r.post("/query")
async def query_request(data: RequestData):
    return ExtractorService.extract(data)
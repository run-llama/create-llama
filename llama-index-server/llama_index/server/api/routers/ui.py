import logging
from typing import List

from fastapi import APIRouter
from llama_index.server.api.models import ComponentDefinition
from llama_index.server.services.custom_ui import CustomUI


def custom_components_router(
    component_dir: str,
    logger: logging.Logger,
) -> APIRouter:
    router = APIRouter(prefix="/components")

    @router.get("")
    async def components() -> List[ComponentDefinition]:
        custom_ui = CustomUI(component_dir=component_dir, logger=logger)
        return custom_ui.get_components()

    return router

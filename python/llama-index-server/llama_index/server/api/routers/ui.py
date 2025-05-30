import logging
from typing import List

from fastapi import APIRouter

from llama_index.server.models.ui import ComponentDefinition
from llama_index.server.services.custom_ui import CustomUI


def custom_components_router(
    component_dir: str,
    logger: logging.Logger,
) -> APIRouter:
    router = APIRouter(prefix="/components")

    @router.get("")
    async def components() -> List[ComponentDefinition]:
        custom_ui = CustomUI(logger=logger)
        return custom_ui.get_components(directory=component_dir)

    return router


def custom_layout_router(
    layout_dir: str,
    logger: logging.Logger,
) -> APIRouter:
    router = APIRouter(prefix="/layout")

    @router.get("")
    async def layout() -> List[ComponentDefinition]:
        custom_ui = CustomUI(logger=logger)
        return custom_ui.get_components(
            directory=layout_dir, filter_types=["header", "footer"]
        )

    return router

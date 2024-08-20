# flake8: noqa: E402
from dotenv import load_dotenv

load_dotenv()


import reflex as rx
from fastapi import FastAPI

from app.api.routers.extractor import extractor_router
from app.settings import init_settings
from app.ui.pages import *  # Keep this import all pages in the app  # noqa: F403

init_settings()


def add_routers(app: FastAPI):
    app.include_router(extractor_router, prefix="/api/extractor")


app = rx.App()
add_routers(app.api)

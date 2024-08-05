from dotenv import load_dotenv

load_dotenv()

import logging
import os

import reflex as rx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.api.routers.extractor import extractor_router
from app.settings import init_settings
from app.ui.pages import *  # Keep this import all pages in the app

init_settings()

environment = os.getenv("ENVIRONMENT", "dev")  # Default to 'development' if not set
logger = logging.getLogger("uvicorn")


def add_routers(app: FastAPI, is_dev: bool = False):
    app.include_router(extractor_router, prefix="/api/extractor")

    if is_dev:
        # Redirect to documentation page when accessing base URL
        @app.get("/")
        async def redirect_to_docs():
            return RedirectResponse(url="/docs")


def update_middlewares(app: FastAPI, is_dev: bool = False):
    if environment == "dev":
        # Allow CORS for development
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )


app = rx.App()
add_routers(app.api, is_dev=environment == "dev")
update_middlewares(app.api, is_dev=environment == "dev")

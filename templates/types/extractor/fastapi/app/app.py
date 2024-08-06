from dotenv import load_dotenv

load_dotenv()

import logging
import os

import reflex as rx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers.extractor import extractor_router
from app.settings import init_settings
from app.ui.pages import *  # Keep this import all pages in the app

init_settings()

environment = os.getenv("ENVIRONMENT", "dev")  # Default to 'development' if not set
logger = logging.getLogger("uvicorn")


def add_routers(app: FastAPI):
    app.include_router(extractor_router, prefix="/api/extractor")

def add_middlewares(app: FastAPI, is_dev: bool = False):
    if is_dev:
        # Allow CORS for development
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )


app = rx.App()
add_routers(app.api)
add_middlewares(app.api, is_dev=environment == "dev")

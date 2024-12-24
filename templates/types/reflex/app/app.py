# flake8: noqa: E402

from dotenv import load_dotenv

load_dotenv()


import reflex as rx

from app.api.routers.main import api_router
from app.settings import init_settings
from app.ui.pages import *  # Keep this import all pages in the app  # noqa: F403

init_settings()


app = rx.App()
app.api.include_router(api_router)

import logging
import os
import subprocess

from app.settings import init_settings
from app.workflow import create_workflow
from dotenv import load_dotenv
from llama_index.server import LlamaIndexServer

logger = logging.getLogger("uvicorn")


def create_app():
    env = os.environ.get("APP_ENV")

    # generates a FastAPI instance that can be extended
    app = LlamaIndexServer(
        workflow_factory=create_workflow,  # Factory function that creates a new workflow for each request
        use_default_routers=True,
        api_prefix="/api",  # Optional, default is `/api`
        env=env,
        logger=logger,
    )
    # You can also add custom routes to the app
    app.add_api_route("/api/health", lambda: {"message": "OK"}, status_code=200)
    return app


load_dotenv()
init_settings()
app = create_app()


def run(env: str):
    os.environ["APP_ENV"] = env
    app_host = os.getenv("APP_HOST", "0.0.0.0")
    app_port = os.getenv("APP_PORT", 8000)

    if env == "dev":
        subprocess.run(["fastapi", "dev", "--host", app_host, "--port", app_port])
    else:
        subprocess.run(["fastapi", "run", "--host", app_host, "--port", app_port])

import json
import logging
import os
from typing import Any, Callable, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from llama_index.core.workflow import Workflow
from llama_index.server.api.routers.chat import chat_router
from llama_index.server.chat_ui import download_chat_ui
from llama_index.server.settings import server_settings


class LlamaIndexServer(FastAPI):
    workflow_factory: Callable[..., Workflow]
    include_ui: Optional[bool]
    starter_questions: Optional[list[str]]
    verbose: bool = False
    ui_path: str = ".ui"

    def __init__(
        self,
        workflow_factory: Callable[..., Workflow],
        logger: Optional[logging.Logger] = None,
        use_default_routers: Optional[bool] = True,
        env: Optional[str] = None,
        include_ui: Optional[bool] = None,
        starter_questions: Optional[list[str]] = None,
        server_url: Optional[str] = None,
        api_prefix: Optional[str] = None,
        verbose: bool = False,
        *args: Any,
        **kwargs: Any,
    ):
        """
        Initialize the LlamaIndexServer.

        Args:
            workflow_factory: A factory function that creates a workflow instance for each request.
            logger: The logger to use.
            use_default_routers: Whether to use the default routers (chat, mount `data` and `output` directories).
            env: The environment to run the server in.
            include_ui: Whether to show an chat UI in the root path.
            starter_questions: A list of starter questions to display in the chat UI.
            server_url: The URL of the server.
            api_prefix: The prefix for the API endpoints.
            verbose: Whether to show verbose logs.
        """
        super().__init__(*args, **kwargs)

        self.workflow_factory = workflow_factory
        self.logger = logger or logging.getLogger("uvicorn")
        self.verbose = verbose
        self.include_ui = include_ui  # Store the explicitly passed value first
        self.starter_questions = starter_questions
        self.use_default_routers = use_default_routers or True

        # Update the settings
        if server_url:
            server_settings.set_url(server_url)
        if api_prefix:
            server_settings.set_api_prefix(api_prefix)

        if self.use_default_routers:
            self.add_default_routers()

        if str(env).lower() == "dev":
            self.allow_cors("*")
            if self.include_ui is None:
                self.include_ui = True
        if self.include_ui is None:
            self.include_ui = False

        if self.include_ui:
            self.mount_ui()

    @property
    def _ui_config(self) -> dict:
        config = {
            "CHAT_API": f"{server_settings.api_url}/chat",
            "STARTER_QUESTIONS": self.starter_questions,
        }
        is_llamacloud_configured = os.getenv("LLAMA_CLOUD_API_KEY") is not None
        if is_llamacloud_configured:
            config["LLAMA_CLOUD_API"] = (
                f"{server_settings.api_url}/chat/config/llamacloud"
            )
        return config

    # Default routers
    def add_default_routers(self) -> None:
        self.add_chat_router()
        self.mount_data_dir()
        self.mount_output_dir()

    def add_chat_router(self) -> None:
        """
        Add the chat router.
        """
        self.include_router(
            chat_router(
                self.workflow_factory,
                self.logger,
            ),
            prefix=server_settings.api_prefix,
        )

    def mount_ui(self) -> None:
        """
        Mount the UI.
        """
        # Check if the static folder exists
        if self.include_ui:
            if not os.path.exists(self.ui_path):
                self.logger.warning(
                    f"UI files not found, downloading UI to {self.ui_path}"
                )
                download_chat_ui(logger=self.logger, target_path=self.ui_path)
            self._mount_static_files(directory=self.ui_path, path="/", html=True)
            self._override_ui_config()

    def _override_ui_config(self) -> None:
        """
        Override the UI config by writing a complete configuration file.
        """
        try:
            config_path = os.path.join(self.ui_path, "config.js")
            if not os.path.exists(config_path):
                self.logger.error("Config file not found")
                return
            config_content = (
                f"window.LLAMAINDEX = {json.dumps(self._ui_config, indent=2)};"
            )
            with open(config_path, "w") as f:
                f.write(config_content)
        except Exception as e:
            self.logger.error(f"Error overriding UI config: {e}")

    def mount_data_dir(self, data_dir: str = "data") -> None:
        """
        Mount the data directory.
        """
        self._mount_static_files(
            directory=data_dir,
            path=f"{server_settings.api_prefix}/files/data",
            html=True,
        )

    def mount_output_dir(self, output_dir: str = "output") -> None:
        """
        Mount the output directory.
        """
        self._mount_static_files(
            directory=output_dir,
            path=f"{server_settings.api_prefix}/files/output",
            html=True,
        )

    def _mount_static_files(
        self, directory: str, path: str, html: bool = False
    ) -> None:
        """
        Mount static files from a directory if it exists.
        """
        if os.path.exists(directory):
            self.logger.info(f"Mounting static files '{directory}' at '{path}'")
            self.mount(
                path,
                StaticFiles(directory=directory, check_dir=False, html=html),
                name=f"{directory}-static",
            )

    def allow_cors(self, origin: str = "*") -> None:
        """
        Allow CORS for a specific origin.
        """
        self.add_middleware(
            CORSMiddleware,
            allow_origins=[origin],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

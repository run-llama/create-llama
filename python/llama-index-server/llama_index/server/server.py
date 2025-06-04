import json
import logging
import os
from typing import Any, Callable, Optional, Union

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import Mount
from fastapi.staticfiles import StaticFiles
from llama_index.core.workflow import Workflow
from llama_index.server.api.routers import (
    chat_router,
    custom_components_router,
    custom_layout_router,
    dev_router,
)
from llama_index.server.chat_ui import copy_bundled_chat_ui
from llama_index.server.settings import server_settings
from pydantic import BaseModel, Field


class UIConfig(BaseModel):
    enabled: bool = Field(default=True, description="Whether to enable the chat UI")
    starter_questions: Optional[list[str]] = Field(
        default=None, description="The starter questions for the chat UI"
    )
    llamacloud_index_selector: bool = Field(
        default=False,
        description="Whether to show the LlamaCloud index selector in the chat UI (need to set the LLAMA_CLOUD_API_KEY environment variable)",
    )
    enable_file_upload: bool = Field(
        default=False,
        description="Whether to enable file upload in the chat UI",
    )
    ui_path: str = Field(
        default=".ui", description="The path that stores static files for the chat UI"
    )
    component_dir: Optional[str] = Field(
        default=None, description="The directory to custom UI components code"
    )
    layout_dir: str = Field(
        default="layout",
        description="The directory to custom UI layout such as header and footer",
    )
    dev_mode: bool = Field(
        default=False, description="Whether to enable the UI dev mode"
    )

    def get_config_content(self) -> str:
        return json.dumps(
            {
                "CHAT_API": f"{server_settings.api_url}/chat",
                "UPLOAD_API": (
                    f"{server_settings.api_url}/chat/file"
                    if self.enable_file_upload
                    else None
                ),
                "STARTER_QUESTIONS": self.starter_questions or [],
                "LLAMA_CLOUD_API": (
                    f"{server_settings.api_url}/chat/config/llamacloud"
                    if self.llamacloud_index_selector
                    and os.getenv("LLAMA_CLOUD_API_KEY")
                    else None
                ),
                "COMPONENTS_API": (
                    f"{server_settings.api_url}/components"
                    if self.component_dir
                    else None
                ),
                "LAYOUT_API": (
                    f"{server_settings.api_url}/layout" if self.layout_dir else None
                ),
                "DEV_MODE": self.dev_mode,
            },
            indent=2,
        )


class LlamaIndexServer(FastAPI):
    workflow_factory: Callable[..., Workflow]
    verbose: bool = False
    ui_config: UIConfig

    def __init__(
        self,
        workflow_factory: Callable[..., Workflow],
        logger: Optional[logging.Logger] = None,
        use_default_routers: Optional[bool] = None,
        env: Optional[str] = None,
        ui_config: Optional[Union[UIConfig, dict]] = None,
        server_url: Optional[str] = None,
        api_prefix: Optional[str] = None,
        suggest_next_questions: Optional[bool] = None,
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
            ui_config: The configuration for the chat UI.
            server_url: The URL of the server.
            api_prefix: The prefix for the API endpoints.
            suggest_next_questions: Whether to suggest next questions after the assistant's response.
            verbose: Whether to show verbose logs.
        """
        super().__init__(*args, **kwargs)

        self.workflow_factory = workflow_factory
        self.logger = logger or logging.getLogger("uvicorn")
        self.verbose = verbose
        self.use_default_routers = (
            True if use_default_routers is None else use_default_routers
        )
        self.suggest_next_questions = (
            True if suggest_next_questions is None else suggest_next_questions
        )
        if ui_config is None:
            self.ui_config = UIConfig()
        elif isinstance(ui_config, dict):
            self.ui_config = UIConfig(**ui_config)
        else:
            self.ui_config = ui_config

        # Update the settings
        if server_url:
            server_settings.set_url(server_url)
        if api_prefix:
            server_settings.set_api_prefix(api_prefix)
        server_settings.set_workflow_factory(workflow_factory.__name__)

        if str(env).lower() == "dev":
            self.allow_cors("*")
            if self.ui_config.enabled is None:
                self.ui_config.enabled = True
        else:
            if self.ui_config.enabled and self.ui_config.dev_mode:
                raise ValueError(
                    "UI dev mode requires the environment variable for LlamaIndexServer to be set to 'dev' and start the FastAPI app in dev mode."
                )
        if self.ui_config.enabled is None:
            self.ui_config.enabled = False

        # Routers
        if self.use_default_routers:
            self.add_default_routers()

        # Should mount ui at the end
        if self.ui_config.enabled:
            self.mount_ui()

    # Default routers
    def add_default_routers(self) -> None:
        self.add_chat_router()
        if self.ui_config.enabled and self.ui_config.dev_mode:
            self.include_router(dev_router(), prefix=server_settings.api_prefix)
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
                self.suggest_next_questions,
            ),
            prefix=server_settings.api_prefix,
        )

    def add_components_router(self) -> None:
        """
        Add the UI router.
        """
        if self.ui_config.component_dir is None:
            raise ValueError("component_dir must be specified to add components router")

        self.include_router(
            custom_components_router(self.ui_config.component_dir, self.logger),
            prefix=server_settings.api_prefix,
        )

    def add_layout_router(self) -> None:
        """
        Add the layout router.
        """
        self.include_router(
            custom_layout_router(self.ui_config.layout_dir, self.logger),
            prefix=server_settings.api_prefix,
        )

    def mount_ui(self) -> None:
        """
        Mount the UI.
        """
        # Check if the static folder exists
        if self.ui_config.enabled:
            # Component dir
            if self.ui_config.component_dir:
                if not os.path.exists(self.ui_config.component_dir):
                    os.makedirs(self.ui_config.component_dir)
                self.add_components_router()
            # Layout dir
            if self.ui_config.layout_dir:
                if not os.path.exists(self.ui_config.layout_dir):
                    os.makedirs(self.ui_config.layout_dir)
                self.add_layout_router()
            # UI static files
            if not os.path.exists(self.ui_config.ui_path):
                os.makedirs(self.ui_config.ui_path)
                self.logger.warning(
                    f"UI files not found at {self.ui_config.ui_path}. Copying bundled UI files."
                )
                copy_bundled_chat_ui(
                    logger=self.logger, target_path=self.ui_config.ui_path
                )
            self._mount_static_files(
                directory=self.ui_config.ui_path,
                path="/",
                html=True,
                name=self.ui_config.ui_path,
            )
            self._override_ui_config()

    def _override_ui_config(self) -> None:
        """
        Override the UI config by writing a complete configuration file.
        """
        try:
            config_path = os.path.join(self.ui_config.ui_path, "config.js")
            if not os.path.exists(config_path):
                self.logger.error("Config file not found")
                return
            config_content = (
                f"window.LLAMAINDEX = {self.ui_config.get_config_content()};"
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
        self,
        directory: str,
        path: str,
        html: bool = False,
        name: Optional[str] = None,
    ) -> None:
        """
        Mount static files from a directory if it exists.
        """
        if os.path.exists(directory):
            self.logger.info(f"Mounting static files '{directory}' at '{path}'")
            self.mount(
                path,
                StaticFiles(directory=directory, check_dir=False, html=html),
                name=name or f"{directory}-static",
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

    def add_api_route(self, *args: Any, **kwargs: Any) -> None:
        """
        Add an API route to the server.
        """
        # Because static files are mounted at the root path by default,
        # we need to place them at the end of the routes list.
        ui_route = None
        for route in self.routes:
            if isinstance(route, Mount):
                if route.name == self.ui_config.ui_path:
                    ui_route = route
                    self.routes.remove(route)
        super().add_api_route(*args, **kwargs)
        if ui_route:
            self.mount(ui_route.path, ui_route.app, name=ui_route.name)

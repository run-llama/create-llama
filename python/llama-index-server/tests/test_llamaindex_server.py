import json
import os
import shutil
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.llms import MockLLM
from llama_index.server import LlamaIndexServer, UIConfig

UI_TEST = os.getenv("UI_TEST", "false").lower() == "true"


def fetch_weather(city: str) -> str:
    """Fetch the weather for a given city."""
    return f"The weather in {city} is sunny."


def _agent_workflow() -> AgentWorkflow:
    # Use MockLLM instead of default OpenAI
    mock_llm = MockLLM()
    return AgentWorkflow.from_tools_or_functions(
        tools_or_functions=[fetch_weather],
        verbose=True,
        llm=mock_llm,
    )


@pytest.fixture()
def server() -> LlamaIndexServer:
    """Fixture to create a LlamaIndexServer instance."""
    return LlamaIndexServer(
        workflow_factory=_agent_workflow,
        verbose=True,
        use_default_routers=True,
        ui_config=UIConfig(enabled=False),
    )


@pytest.mark.asyncio()
async def test_server_has_chat_route(server: LlamaIndexServer) -> None:
    """Test that the server has the chat API route."""
    chat_route_exists = any("/api/chat" in str(route) for route in server.routes)
    assert chat_route_exists, "Chat API route not found in server routes"


@pytest.mark.asyncio()
async def test_server_swagger_docs(server: LlamaIndexServer) -> None:
    """Test that the server serves Swagger UI docs."""
    async with AsyncClient(
        transport=ASGITransport(app=server), base_url="http://test"
    ) as ac:
        response = await ac.get("/docs")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "Swagger UI" in response.text


# UI Integration Tests
# Make sure you run the scripts/build_frontend.py script before running these tests
if UI_TEST:

    @pytest.mark.asyncio()
    async def test_ui_is_copied_and_mounted(tmp_path: Path) -> None:
        """
        Test if the UI is copied from bundle and mounted correctly.
        """
        tmp_ui_dir = str(tmp_path / "ui")
        print(f"tmp_ui_dir: {tmp_ui_dir}")
        tmp_component_dir = tempfile.mkdtemp()

        # Create a new server with UI enabled
        ui_config = UIConfig(
            enabled=True,
            app_title="Test UI",
            starter_questions=["What's the weather like?"],
            ui_path=tmp_ui_dir,
            component_dir=tmp_component_dir,
        )
        ui_server = LlamaIndexServer(
            workflow_factory=_agent_workflow,
            verbose=True,
            use_default_routers=True,
            env="dev",
            ui_config=ui_config,
        )

        # Verify that static directory was created with index.html
        # List files in tmp_ui_dir
        print("Files in tmp_ui_dir: ", os.listdir(tmp_ui_dir))
        assert os.path.exists(tmp_ui_dir), "Static directory was not created"
        assert os.path.isdir(tmp_ui_dir), "Static path is not a directory"
        assert os.path.exists(os.path.join(tmp_ui_dir, "index.html")), (
            "index.html was not copied from bundle"
        )

        # Check if the config.js was created with correct content
        config_path = os.path.join(tmp_ui_dir, "config.js")
        assert os.path.exists(config_path), "config.js was not created"

        with open(config_path, "r") as f:
            config_content = f.read()
            assert "window.LLAMAINDEX =" in config_content
            config_json = json.loads(
                config_content.replace("window.LLAMAINDEX = ", "").rstrip(";")
            )
            assert config_json["CHAT_API"] == "/api/chat"
            assert config_json["STARTER_QUESTIONS"] == ["What's the weather like?"]
            assert config_json["LLAMA_CLOUD_API"] is None
            assert config_json["APP_TITLE"] == "Test UI"

        # Verify directory was created
        assert os.path.exists(tmp_component_dir), "Component directory was not created"
        assert os.path.isdir(tmp_component_dir), "Component path is not a directory"

        # Verify component route exists
        component_route_exists = any(
            route.path == "/api/components"  # type: ignore
            for route in ui_server.routes
        )
        assert component_route_exists, "Component API route not found in server routes"

        # Check if the UI is mounted and accessible
        async with AsyncClient(
            transport=ASGITransport(app=ui_server), base_url="http://test"
        ) as ac:
            response = await ac.get("/")
            assert response.status_code == 200
            assert "text/html" in response.headers["content-type"]

        # Clean up after test
        shutil.rmtree(tmp_ui_dir)
        shutil.rmtree(tmp_component_dir)


@pytest.mark.asyncio()
async def test_component_router_requires_component_dir() -> None:
    """
    Test that adding components router without component_dir raises an error.
    """
    tmp_ui_dir = tempfile.mkdtemp()
    server_without_component_dir = LlamaIndexServer(
        workflow_factory=_agent_workflow,
        verbose=True,
        ui_config=UIConfig(enabled=True, ui_path=tmp_ui_dir),
    )

    with pytest.raises(
        ValueError, match="component_dir must be specified to add components router"
    ):
        server_without_component_dir.add_components_router()

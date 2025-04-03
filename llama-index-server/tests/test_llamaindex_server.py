import json
import os
import shutil

import pytest
from httpx import ASGITransport, AsyncClient

from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.llms import MockLLM
from llama_index.server import LlamaIndexServer, UIConfig


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
        mount_ui=False,
        env="dev",
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


@pytest.mark.asyncio()
async def test_ui_is_downloaded(server: LlamaIndexServer) -> None:
    """
    Test if the UI is downloaded and mounted correctly.
    """
    # Clean up any existing static directory first
    if os.path.exists(".ui"):
        shutil.rmtree(".ui")

    # Create a new server with UI enabled
    ui_config = UIConfig(
        enabled=True,
        app_title="Test UI",
        starter_questions=["What's the weather like?"],
    )
    ui_server = LlamaIndexServer(
        workflow_factory=_agent_workflow,
        verbose=True,
        use_default_routers=True,
        env="dev",
        ui_config=ui_config,
    )

    # Verify that static directory was created with index.html
    assert os.path.exists("./.ui"), "Static directory was not created"
    assert os.path.isdir("./.ui"), "Static path is not a directory"
    assert os.path.exists("./.ui/index.html"), "index.html was not downloaded"

    # Check if the config.js was created with correct content
    config_path = os.path.join(".ui", "config.js")
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

    # Check if the UI is mounted and accessible
    async with AsyncClient(
        transport=ASGITransport(app=ui_server), base_url="http://test"
    ) as ac:
        response = await ac.get("/")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    # Clean up after test
    shutil.rmtree("./.ui")


@pytest.mark.asyncio()
async def test_ui_is_accessible(server: LlamaIndexServer) -> None:
    """
    Test if the UI is accessible.
    """
    # Manually trigger UI mounting
    server.mount_ui()

    async with AsyncClient(
        transport=ASGITransport(app=server), base_url="http://test"
    ) as ac:
        response = await ac.get("/")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]


@pytest.mark.asyncio()
async def test_ui_config_customization() -> None:
    """
    Test if UI configuration can be customized.
    """
    custom_config = UIConfig(
        enabled=True,
        app_title="Custom App",
        starter_questions=["Question 1", "Question 2"],
        ui_path=".custom_ui",
    )

    server = LlamaIndexServer(
        workflow_factory=_agent_workflow, verbose=True, ui_config=custom_config
    )

    assert server.ui_config.app_title == "Custom App"
    assert server.ui_config.starter_questions == ["Question 1", "Question 2"]
    assert server.ui_config.ui_path == ".custom_ui"

    # Clean up if directory was created
    if os.path.exists(".custom_ui"):
        shutil.rmtree(".custom_ui")


@pytest.mark.asyncio()
async def test_ui_config_from_dict() -> None:
    """
    Test if UI configuration can be initialized from a dictionary.
    """
    ui_config_dict = {
        "enabled": True,
        "app_title": "Dict Config App",
        "starter_questions": ["Dict Q1", "Dict Q2"],
        "ui_path": ".dict_ui",
    }

    server = LlamaIndexServer(
        workflow_factory=_agent_workflow,
        verbose=True,
        ui_config=ui_config_dict,
    )

    # Verify the config was properly converted to UIConfig object
    assert isinstance(server.ui_config, UIConfig)
    assert server.ui_config.app_title == "Dict Config App"
    assert server.ui_config.starter_questions == ["Dict Q1", "Dict Q2"]
    assert server.ui_config.ui_path == ".dict_ui"

    # Verify the config.js is created with correct content
    server.mount_ui()
    config_path = os.path.join(".dict_ui", "config.js")
    assert os.path.exists(config_path), "config.js was not created"

    with open(config_path, "r") as f:
        config_content = f.read()
        assert "window.LLAMAINDEX =" in config_content
        config_json = json.loads(
            config_content.replace("window.LLAMAINDEX = ", "").rstrip(";")
        )
        assert config_json["APP_TITLE"] == "Dict Config App"
        assert config_json["STARTER_QUESTIONS"] == ["Dict Q1", "Dict Q2"]
        assert config_json["CHAT_API"] == "/api/chat"
        assert config_json["LLAMA_CLOUD_API"] is None

    # Clean up
    if os.path.exists(".dict_ui"):
        shutil.rmtree(".dict_ui")

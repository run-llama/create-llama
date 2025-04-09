import pytest
from httpx import ASGITransport, AsyncClient
from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.llms import MockLLM
from llama_index.server import LlamaIndexServer


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
    chat_route_exists = any(route.path == "/api/chat" for route in server.routes)
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
    import os
    import shutil

    # Clean up any existing static directory first
    if os.path.exists(".ui"):
        shutil.rmtree(".ui")

    # Create a new server with UI enabled
    ui_server = LlamaIndexServer(
        workflow_factory=_agent_workflow,
        verbose=True,
        use_default_routers=True,
        env="dev",
        include_ui=True,
    )

    # Verify that static directory was created with index.html
    assert os.path.exists("./.ui"), "Static directory was not created"
    assert os.path.isdir("./.ui"), "Static path is not a directory"
    assert os.path.exists("./.ui/index.html"), "index.html was not downloaded"

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
async def test_component_dir_creation(server: LlamaIndexServer) -> None:
    """
    Test if the component directory is created when specified and doesn't exist.
    """
    import os
    import shutil

    test_component_dir = "./test_components"
    
    # Clean up any existing directory
    if os.path.exists(test_component_dir):
        shutil.rmtree(test_component_dir)
    
    # Create server with component directory
    _ = LlamaIndexServer(
        workflow_factory=_agent_workflow,
        verbose=True,
        component_dir=test_component_dir,
        include_ui=True
    )
    
    # Verify directory was created
    assert os.path.exists(test_component_dir), "Component directory was not created"
    assert os.path.isdir(test_component_dir), "Component path is not a directory"
    
    # Clean up after test
    shutil.rmtree(test_component_dir)


@pytest.mark.asyncio()
async def test_component_router_addition(server: LlamaIndexServer) -> None:
    """
    Test if the component router is added when component directory is specified.
    """
    test_component_dir = "./test_components"
    
    # Create server with component directory
    component_server = LlamaIndexServer(
        workflow_factory=_agent_workflow,
        verbose=True,
        component_dir=test_component_dir,
        include_ui=True
    )
    
    # Verify component route exists
    component_route_exists = any(
        route.path == "/api/components" for route in component_server.routes
    )
    assert component_route_exists, "Component API route not found in server routes"


@pytest.mark.asyncio()
async def test_ui_config_includes_components_api(server: LlamaIndexServer) -> None:
    """
    Test if the UI config includes components API when component directory is set.
    """
    test_component_dir = "./test_components"
    
    # Create server with component directory
    component_server = LlamaIndexServer(
        workflow_factory=_agent_workflow,
        verbose=True,
        component_dir=test_component_dir,
        include_ui=True
    )
    
    # Check if components API is in UI config
    ui_config = component_server._ui_config
    assert "COMPONENTS_API" in ui_config, "Components API not found in UI config"
    assert ui_config["COMPONENTS_API"].endswith("/components"), "Incorrect components API path"

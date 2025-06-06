# LlamaIndex Server

LlamaIndexServer is a FastAPI-based application that allows you to quickly launch your [LlamaIndex Workflows](https://docs.llamaindex.ai/en/stable/module_guides/workflow/#workflows) and [Agent Workflows](https://docs.llamaindex.ai/en/stable/understanding/agent/multi_agent/) as an API server with an optional chat UI. It provides a complete environment for running LlamaIndex workflows with both API endpoints and a user interface for interaction.

## Features

- Serving a workflow as a chatbot
- Built on FastAPI for high performance and easy API development
- Optional built-in chat UI with extendable UI components
- Prebuilt development code
- Human-in-the-loop (HITL) support, check out the [Human-in-the-loop](https://github.com/run-llama/create-llama/blob/main/python/llama-index-server/examples/hitl/README.md) documentation for more details.

## Installation

```bash
pip install llama-index-server
```

## Quick Start

```python
# main.py
from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.workflow import Workflow
from llama_index.core.tools import FunctionTool
from llama_index.server import LlamaIndexServer


# Define a factory function that returns a Workflow or AgentWorkflow
def create_workflow() -> Workflow:
    def fetch_weather(city: str) -> str:
        return f"The weather in {city} is sunny"

    return AgentWorkflow.from_tools(
        tools=[
            FunctionTool.from_defaults(
                fn=fetch_weather,
            )
        ]
    )


# Create an API server for the workflow
app = LlamaIndexServer(
    workflow_factory=create_workflow,  # Supports Workflow or AgentWorkflow
    env="dev",  # Enable development mode
    ui_config={ # Configure the chat UI, optional
        "starter_questions": ["What is the weather in LA?", "Will it rain in SF?"],
    },
    verbose=True
)
```

## Running the Server

- In the same directory as `main.py`, run the following command to start the server:

  ```bash
  fastapi dev
  ```

- Making a request to the server:

  ```bash
  curl -X POST "http://localhost:8000/api/chat" -H "Content-Type: application/json" -d '{"message": "What is the weather in Tokyo?"}'
  ```

- See the API documentation at `http://localhost:8000/docs`
- Access the chat UI at `http://localhost:8000/` (Make sure you set the `env="dev"` or `include_ui=True` in the server configuration)

## Configuration Options

The LlamaIndexServer accepts the following configuration parameters:

- `workflow_factory`: A callable that creates a workflow instance for each request. See [Workflow factory contract](#workflow-factory-contract) for more details.
- `logger`: Optional logger instance (defaults to uvicorn logger)
- `use_default_routers`: Whether to include default routers (chat, static file serving)
- `env`: Environment setting ('dev' enables CORS and UI by default)
- `ui_config`: UI configuration as a dictionary or UIConfig object with options:
  - `enabled`: Whether to enable the chat UI (default: True)
  - `enable_file_upload`: Whether to enable file upload in the chat UI (default: False). Check [How to get the uploaded files in your workflow](https://github.com/run-llama/create-llama/blob/main/python/llama-index-server/examples/private_file/README.md#how-to-get-the-uploaded-files-in-your-workflow) for more details.
  - `starter_questions`: List of starter questions for the chat UI (default: None)
  - `ui_path`: Path for downloaded UI static files (default: ".ui")
  - `component_dir`: The directory for custom UI components rendering events emitted by the workflow. The default is None, which does not render custom UI components.
  - `layout_dir`: The directory for custom layout sections. The default value is `layout`. See [Custom Layout](https://github.com/run-llama/create-llama/blob/main/python/llama-index-server/docs/custom_layout.md) for more details.
  - `llamacloud_index_selector`: Whether to show the LlamaCloud index selector in the chat UI (default: False). Requires `LLAMA_CLOUD_API_KEY` to be set.
  - `dev_mode`: When enabled, you can update workflow code in the UI and see the changes immediately. It's currently in beta and only supports updating workflow code at `app/workflow.py`. You might also need to set `env="dev"` and start the server with the reload feature enabled.
- `suggest_next_questions`: Whether to suggest next questions after the assistant's response (default: True). You can change the prompt for the next questions by setting the `NEXT_QUESTION_PROMPT` environment variable. The default prompt used is defined in  `llama_index.server.prompts.SUGGEST_NEXT_QUESTION_PROMPT`.
- `verbose`: Enable verbose logging
- `api_prefix`: API route prefix (default: "/api")
- `server_url`: The deployment URL of the server (default is None)

## Workflow factory contract

The `workflow_factory` provided will be called for each chat request to initialize a new workflow instance. Additionally, we provide the [ChatRequest](https://github.com/run-llama/create-llama/blob/afe9e9fc16427d20e1dfb635a45e7ed4b46285cb/python/llama-index-server/llama_index/server/api/models.py#L32) object, which includes the request information that is helpful for initializing the workflow. For example:
```python
def create_workflow(chat_request: ChatRequest) -> Workflow:
    # using messages from the chat request to initialize the workflow
    return MyCustomWorkflow(chat_request.messages)
```

Your workflow will be executed once for each chat request with the following input parameters are included in workflow's `StartEvent`:
- `user_msg` [str]: The current user message
- `chat_history` [list[[ChatMessage](https://docs.llamaindex.ai/en/stable/api_reference/prompts/#llama_index.core.prompts.ChatMessage)]]: All the previous messages of the conversation

Example:
```python
@step
def handle_start_event(ev: StartEvent) -> MyNextEvent:
    user_msg = ev.user_msg
    chat_history = ev.chat_history
    ...
```

Your workflows can emit `UIEvent` events to render [Custom UI Components](https://github.com/run-llama/create-llama/blob/main/python/llama-index-server/docs/custom_ui_component.md) in the chat UI to improve the user experience.
Furthermore, you can send `ArtifactEvent` events to render code or document [Artifacts](https://github.com/run-llama/create-llama/blob/main/python/llama-index-server/docs/custom_artifact_event.md) in a dedicated Canvas panel in the chat UI.

## Default Routers and Features

### Chat Router

The server includes a default chat router at `/api/chat` for handling chat interactions.

### Static File Serving

- The server automatically mounts the `data` and `output` folders at `{server_url}{api_prefix}/files/data` (default: `/api/files/data`) and `{server_url}{api_prefix}/files/output` (default: `/api/files/output`) respectively.
- Your workflows can use both folders to store and access files. As a convention, the `data` folder is used for documents that are ingested and the `output` folder is used for documents that are generated by the workflow.
- The example workflows from `create-llama` (see below) are following this pattern.

### Chat UI

When enabled, the server provides a chat interface at the root path (`/`) with:

- Configurable starter questions
- Real-time chat interface
- API endpoint integration

## Development Mode

In development mode (`env="dev"`), the server:

- Enables CORS for all origins
- Automatically includes the chat UI
- Provides more verbose logging

### Workflow Editor (Beta)

In development mode, you can set `dev_mode` to `True` in the UI configuration to enable the workflow editor, which allows you to edit the workflow code directly in the browser.

```python
app = LlamaIndexServer(
    workflow_factory=create_workflow,
    env="dev",
    ui_config={"dev_mode": True},
)
```

**Note**: The workflow editor is currently in beta and only supports updating LlamaIndexServer projects created with [create-llama](https://github.com/run-llama/create-llama/). You also need to start the server via `fastapi dev` so that the server can hot reload the workflow code.

## API Endpoints

The server provides the following default endpoints:

- `/api/chat`: Chat interaction endpoint
- `/api/chat/file`: File upload endpoint (only available when `enable_file_upload` in `ui_config` is True)
- `/api/files/data/*`: Access to data directory files
- `/api/files/output/*`: Access to output directory files

## Best Practices

1. Use environment variables for sensitive configuration
2. Enable verbose logging during development
3. Configure CORS appropriately for your deployment environment
4. Use starter questions to guide users in the chat UI

## Getting Started with a New Project

Want to start a new project with LlamaIndexServer? Check out our [create-llama](https://github.com/run-llama/create-llama) tool to quickly generate a new project with LlamaIndexServer.

# LlamaIndex Server (Python)

## Overview

The `llama-index-server` package is a FastAPI-based server framework for deploying LlamaIndex Workflows and Agent Workflows as a high-performance API server with an optional chat UI. It provides a complete environment for running LlamaIndex workflows with both API endpoints and a user interface for interaction.

## Package Structure

### Core Components
- **`llama_index/server/server.py`**: Main `LlamaIndexServer` class extending FastAPI
- **`llama_index/server/__init__.py`**: Package exports (`LlamaIndexServer`, `UIConfig`, `UIEvent`)
- **`pyproject.toml`**: Package configuration with dependencies and build settings

### Key Directories
- **`api/`**: FastAPI routers, models, and request handling
- **`services/`**: Business logic for file handling, LlamaCloud integration, and UI generation
- **`tools/`**: Document generation, interpreter tools, and index querying utilities
- **`gen_ui/`**: AI-powered UI component generation system
- **`resources/`**: Static assets and bundled UI files
- **`examples/`**: Sample workflows demonstrating different features

## Core Functionality

### LlamaIndexServer Class
Main server implementation that extends FastAPI with workflow-specific features:
- **Workflow Factory Pattern**: Creates workflow instances per request using factory functions
- **UI Configuration**: Manages chat interface, custom components, and layout directories
- **File Serving**: Automatically mounts `data/` and `output/` directories
- **Development Mode**: Enables CORS, verbose logging, and hot reloading

### Chat API (`api/routers/chat.py`)
- **Endpoint**: `/api/chat` for chat interactions
- **Streaming Responses**: Real-time workflow execution with Vercel-compatible streaming
- **Message Handling**: Converts between API and LlamaIndex message formats
- **Background Tasks**: File downloads and asynchronous processing
- **LlamaCloud Integration**: Optional index selector for cloud-based retrieval

### Event System (`api/models.py`)
Structured event types for workflow communication:
- **`UIEvent`**: Custom UI component rendering with Pydantic data models
- **`ArtifactEvent`**: Code and document artifacts for Canvas panel display
- **`SourceNodesEvent`**: Document sources with metadata and file URLs
- **`AgentRunEvent`**: Agent tool usage and progress tracking

### UI Generation (`gen_ui/main.py`)
AI-powered component generation using LLM workflows:
- **`GenUIWorkflow`**: Multi-step process for creating React components
- **Planning Phase**: Analyzes event schemas to design UI layouts
- **Aggregation Logic**: Groups events for optimized rendering
- **Code Generation**: Creates shadcn/ui components with proper imports
- **Validation**: Ensures generated code uses only supported dependencies

## Development Environment

### Dependencies
```toml
# Core FastAPI server with standard extensions
fastapi[standard]>=0.115.11,<1.0.0

# LlamaIndex core and workflow engine
llama-index-core>=0.12.28,<1.0.0

# File handling and cloud integration
llama-index-readers-file>=0.4.6,<1.0.0
llama-index-indices-managed-llama-cloud>=0.6.3,<1.0.0

# HTTP requests and caching
requests>=2.32.3,<3.0.0
cachetools>=5.5.2,<6.0.0
pydantic-settings>=2.8.1,<3.0.0
```

### Development Dependencies
- **Testing**: pytest, pytest-asyncio, pytest-mock for comprehensive testing
- **Code Quality**: black, ruff, mypy, pylint for code formatting and linting
- **Documentation**: jupyter, markdown for examples and documentation
- **Integrations**: e2b-code-interpreter, llama-cloud for extended functionality

### Build System
- **Backend**: Hatchling for Python package building
- **Artifacts**: Includes `llama_index/server/resources` for bundled UI assets
- **Type Checking**: MyPy with strict settings for type safety

## Configuration Options

### Server Configuration
```python
LlamaIndexServer(
    workflow_factory=create_workflow,  # Required: factory function
    env="dev",                        # Environment: "dev" enables CORS and UI
    ui_config={                       # Optional UI configuration
        "enabled": True,              # Enable chat interface
        "starter_questions": [...],   # Predefined user prompts
        "component_dir": "components", # Custom UI components directory
        "layout_dir": "layout",       # Custom layout sections directory
        "dev_mode": True,             # Enable live code editing
        "llamacloud_index_selector": False, # LlamaCloud integration
    },
    suggest_next_questions=True,      # Auto-generate follow-up questions
    verbose=True,                     # Enable detailed logging
    api_prefix="/api",               # API route prefix
    server_url="http://localhost:8000", # Deployment URL
)
```

### Workflow Factory Contract
```python
def create_workflow(chat_request: ChatRequest) -> Workflow:
    # Access to request information for initialization
    return MyCustomWorkflow(chat_request.messages)

# Workflow input parameters (StartEvent):
# - user_msg: str - Current user message
# - chat_history: List[ChatMessage] - Previous conversation messages
```

## API Endpoints

### Default Routes
- **`/api/chat`**: Main chat interaction endpoint with streaming responses
- **`/api/files/data/*`**: Static file serving from data directory
- **`/api/files/output/*`**: Generated file serving from output directory
- **`/api/components`**: Custom UI component serving (if configured)
- **`/api/layout`**: Custom layout component serving (if configured)
- **`/api/chat/config/llamacloud`**: LlamaCloud configuration (if enabled)

### Development Routes (Dev Mode)
- **`/api/dev/*`**: Live code editing and hot reloading endpoints

## UI System

### Chat Interface
When enabled (`ui_config.enabled=True`), provides:
- **Real-time Chat**: WebSocket-like streaming with message history
- **Starter Questions**: Configurable prompts to guide users
- **Canvas Panel**: Dedicated area for code and document artifacts
- **Custom Components**: React components for workflow-specific events
- **Custom Layout**: Configurable header/footer sections

### Component Generation
Automated UI component creation for workflow events:
- **Event Analysis**: Parses Pydantic schemas to understand data structure
- **Design Planning**: LLM generates layout descriptions based on event types
- **Code Generation**: Creates React components using shadcn/ui and Tailwind CSS
- **Dependency Validation**: Ensures only supported libraries are used

### Supported UI Dependencies
- **React**: Core framework with hooks and state management
- **shadcn/ui**: Complete component library (Button, Card, Table, etc.)
- **Lucide React**: Icon library for visual elements
- **Tailwind CSS**: Utility-first styling with `cn` helper
- **LlamaIndex Chat UI**: Markdown rendering and specialized widgets

## File Handling

### Directory Structure
```
project/
├── data/           # Input documents and ingestion files
├── output/         # Generated files and workflow outputs
├── components/     # Custom UI components (optional)
├── layout/         # Custom layout sections (optional)
└── .ui/           # Downloaded UI static files
```

### File Serving
- **Automatic Mounting**: `data/` and `output/` directories served at `/api/files/`
- **URL Generation**: Metadata-based file URL creation for source nodes
- **LlamaCloud Integration**: Background downloading of cloud-hosted files
- **Static Assets**: UI resources bundled with package installation

## Development Features

### Hot Reloading (Beta)
```python
# Enable development mode
app = LlamaIndexServer(
    workflow_factory=create_workflow,
    env="dev",                    # Required for dev features
    ui_config={"dev_mode": True}, # Enable live editing
)
```
- **Live Code Editing**: Modify workflow code in browser interface
- **Automatic Restart**: FastAPI dev mode integration for instant updates
- **File Watching**: Monitors `app/workflow.py` for changes

### Logging and Debugging
- **Verbose Mode**: Detailed request/response logging
- **Error Handling**: Comprehensive exception catching and reporting
- **Stream Monitoring**: Real-time event tracking during workflow execution

## Integration Points

### LlamaIndex Core
- **Workflow Engine**: Full support for Workflow and AgentWorkflow classes
- **Message Types**: Native ChatMessage and MessageRole compatibility
- **Node Processing**: Automatic source node extraction and URL generation
- **Tool Integration**: Function tools and external service connections

### FastAPI Ecosystem
- **Middleware**: CORS, authentication, and custom request processing
- **Background Tasks**: Asynchronous file operations and processing
- **Static Files**: Efficient serving of UI assets and generated content
- **API Documentation**: Automatic OpenAPI/Swagger documentation generation

### External Services
- **LlamaCloud**: Cloud-based indexing and retrieval services
- **File Readers**: Support for various document formats via LlamaIndex readers
- **Code Interpreters**: Integration with E2B and other execution environments

## Examples and Templates

### Simple Workflow
Basic agent with tool integration and starter questions for user guidance.

### Agentic RAG
Document retrieval system with vector indexing, query processing, and source citations.

### Custom Layout
Branded interface with custom header components and layout customization.

### Development Mode
Live code editing with hot reloading and separate workflow file organization.

## Best Practices

### Server Setup
1. **Environment Variables**: Use `.env` files for API keys and configuration
2. **Development vs Production**: Proper environment separation with `env` parameter
3. **Resource Management**: Monitor memory usage with large document collections
4. **Error Handling**: Implement comprehensive logging and exception handling

### Workflow Design
1. **Factory Pattern**: Use factory functions for stateless workflow creation
2. **Event Emission**: Leverage `UIEvent` and `ArtifactEvent` for rich user experience
3. **Message Handling**: Process chat history appropriately in workflow logic
4. **Tool Integration**: Follow LlamaIndex patterns for external service connections

### UI Development
1. **Component Organization**: Structure custom components in dedicated directories
2. **Event Schemas**: Design clear Pydantic models for UI generation
3. **Layout Consistency**: Use shared layout components across workflows
4. **Performance**: Consider event aggregation for large data sets

This package provides a comprehensive foundation for deploying production-ready LlamaIndex applications with professional chat interfaces, extensible UI components, and robust API endpoints.
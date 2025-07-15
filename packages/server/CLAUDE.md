# @llamaindex/server Package

This package provides a Next.js-based server framework for running LlamaIndex workflows with both API endpoints and a chat UI interface.

## Overview

The `@llamaindex/server` package (`src/`) allows you to quickly launch LlamaIndex Workflows and Agent Workflows as an API server with an optional sophisticated chat UI. It combines a backend API server with a frontend React interface built on Next.js.

## Key Components

### Core Server (src/server.ts)

- **LlamaIndexServer class**: Main server implementation that wraps Next.js
- Handles workflow factory initialization and UI configuration
- Manages custom components and layout directories
- Creates HTTP server with custom routing for chat API
- Automatically configures client-side config in `public/config.js`

### Chat Handler (src/handlers/chat.ts)

- **handleChat function**: Processes POST requests to `/api/chat`
- Converts AI SDK messages to LlamaIndex format
- Manages workflow execution with abort signals
- Streams responses back to client with optional question suggestions
- Handles errors and validation

### Workflow Management (src/utils/workflow.ts)

- **runWorkflow function**: Executes workflows with proper event handling
- Transforms workflow events (tool calls, source nodes) into UI-friendly formats
- Downloads LlamaCloud files automatically in background
- Processes agent events and source annotations

### Event System (src/events.ts)

- **Source Events**: For displaying document/file sources with metadata
- **Agent Events**: For showing agent tool usage and progress
- **Artifact Events**: For structured data like code/documents sent to Canvas UI
- Helper functions for converting LlamaIndex data to UI events

### UI Generation (src/utils/gen-ui.ts)

- **generateEventComponent function**: Uses LLM to auto-generate React components
- Creates workflow for UI planning, aggregation, and code generation
- Validates generated components against supported dependencies
- Supports shadcn/ui, lucide-react, tailwind CSS, and LlamaIndex chat-ui

### Types (src/types.ts)

- **WorkflowFactory**: Function signature for creating workflow instances
- **UIConfig**: Configuration options for chat interface
- **LlamaIndexServerOptions**: Main server configuration interface

## Next.js Frontend

The `next/` directory contains the React frontend:

### API Routes

- `/api/chat/route.ts`: Main chat endpoint (delegates to handleChat)
- `/api/components/route.ts`: Serves custom UI components
- `/api/layout/route.ts`: Serves custom layout components
- `/api/files/[...slug]/route.ts`: File serving for data/output folders

### UI Components

- Chat interface with message history, streaming responses, and canvas panel
- Extensible component system for custom workflow events
- Custom layout support for headers/footers
- Built with shadcn/ui components and Tailwind CSS

## Build Process

### Development

```bash
pnpm dev  # Watch mode with bunchee
```

### Production Build

```bash
pnpm build  # Multi-step build process
```

The build process:

1. **prebuild**: Cleans dist, server, and temp directories
2. **build**: Compiles source with bunchee to ESM/CJS
3. **postbuild**: Prepares TypeScript server and Python static assets
4. **prepare:ts-server**: Copies Next.js app, builds CSS, compiles API routes
5. **prepare:py-static**: Creates static build for Python integration

## Key Features

### Workflow Integration

- Factory pattern for creating workflow instances per request
- Supports Agent Workflows with startAgentEvent/stopAgentEvent contract
- Automatic event transformation and streaming
- Built-in tool call and source node handling

### UI Extensibility

- AI-generated components based on Zod schemas
- Custom layout sections (header/footer)
- Canvas panel for artifacts (documents, code)
- Event aggregation and real-time updates

### File Handling

- Automatic mounting of `data/` and `output/` folders
- LlamaCloud file downloads in background
- Static asset serving through Next.js

### Development Features

- Hot reload support for workflow code (beta)
- Dev mode panel for live code editing
- TypeScript support throughout
- Comprehensive error handling

## Configuration

Server configuration through `LlamaIndexServerOptions`:

- `workflow`: Factory function for creating workflow instances
- `uiConfig.starterQuestions`: Predefined questions for chat interface
- `uiConfig.componentsDir`: Directory for custom event components
- `uiConfig.layoutDir`: Directory for custom layout components
- `uiConfig.devMode`: Enable live code editing
- `suggestNextQuestions`: Auto-suggest follow-up questions
- `llamaCloud`: An object to configure the LlamaCloud integration containing the following properties:
  - `outputDir`: The directory for LlamaCloud output
  - `indexSelector`: Whether to show the LlamaCloud index selector in the chat UI

## Dependencies

### Runtime Dependencies

- Next.js 15+ for server framework
- React 19+ for UI components
- LlamaIndex workflow engine
- Radix UI components (shadcn/ui)
- AI SDK for streaming responses

### Development Dependencies

- Bunchee for bundling
- TypeScript for type safety
- Tailwind CSS for styling
- PostCSS for CSS processing

## Usage Patterns

1. **Basic Setup**: Create workflow factory, configure UI, start server
2. **Custom Events**: Define Zod schemas, generate UI components with LLM
3. **File Integration**: Use data/output folders for document processing
4. **Development**: Use dev mode for iterative workflow development
5. **Production**: Build static assets for deployment with Python backend

The package serves as a complete solution for deploying LlamaIndex workflows with professional chat interfaces and extensible UI components.

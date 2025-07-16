# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Create-llama is a monorepo containing CLI tools and server frameworks for building LlamaIndex-powered applications. The repository combines TypeScript/Node.js and Python components in a unified development environment.

## Architecture

### Monorepo Structure

- **`packages/create-llama/`**: Main CLI tool for scaffolding LlamaIndex applications
- **`python/llama-index-server/`**: Python/FastAPI server framework
- **Root**: Workspace configuration and shared development tools

### Key Technologies

- **Package Manager**: pnpm with workspace configuration
- **Build Tools**: bunchee (TypeScript), Next.js, hatchling (Python)
- **Testing**: Playwright for e2e, pytest for Python
- **Version Management**: changesets for TypeScript packages, manual for Python

## Development Commands

### Root Level (Monorepo)

```bash
pnpm dev          # Start all packages in development mode
pnpm build        # Build all packages
pnpm lint         # ESLint across TypeScript packages
pnpm format       # Prettier formatting
pnpm e2e          # Run end-to-end tests
```

### Create-llama Package

```bash
cd packages/create-llama
npm run build     # Build CLI using bash script and ncc
npm run dev       # Watch mode development
npm run e2e       # Playwright tests for generated projects
npm run clean     # Clean build artifacts and template caches
```

### Python Server Package

```bash
cd python/llama-index-server
uv run generate   # Index data files
fastapi dev       # Start development server with hot reload
pytest            # Run test suite
```

## Template System

The CLI uses a sophisticated template system in `packages/create-llama/templates/`:

### Organization

- **`types/`**: Base project structures (streaming, reflex, llamaindexserver)
- **`components/`**: Reusable components across frameworks
  - `engines/` - Chat and agent engines
  - `loaders/` - File, web, database loaders
  - `providers/` - AI model configurations
  - `vectordbs/` - Vector database integrations
  - `use-cases/` - Workflow implementations

### Development Workflow

- Templates support multiple frameworks (Next.js, Express, FastAPI)
- Component system allows mix-and-match functionality
- E2E tests validate generated projects work correctly

## Server Framework Architecture

### Python Server (`llama-index-server`)

- **Core**: `LlamaIndexServer` class extending FastAPI
- **Architecture**: Workflow factory pattern for stateless request handling
- **UI Generation**: AI-powered React component generation from Pydantic schemas
- **Development**: Hot reloading support with dev mode

## Common Patterns

### Workflow Integration

Both server frameworks use factory patterns:

```typescript
// TypeScript
const server = new LlamaIndexServer({
  workflow: (context) => createWorkflow(context)
});

// Python
def create_workflow(chat_request: ChatRequest) -> Workflow:
    return MyWorkflow(chat_request.messages)
```

### Event System

Structured events for UI communication:

- **UIEvent**: Custom components with Pydantic/Zod schemas
- **ArtifactEvent**: Code/documents for Canvas panel
- **SourceNodesEvent**: Document sources with metadata
- **AgentRunEvent**: Tool usage and progress tracking

### File Handling

- Both servers auto-mount `data/` and `output/` directories
- LlamaCloud integration for remote file access
- Static file serving through framework-specific methods

## Testing Strategy

### E2E Testing

- Playwright tests in `packages/create-llama/e2e/`
- Tests both Python and TypeScript generated projects
- Validates CLI generation and application functionality

### Unit Testing

- Python: pytest with comprehensive API and service tests
- TypeScript: Integrated testing through build process

## Build Process

### Create-llama CLI

1. TypeScript compilation with bash script
2. ncc bundling for standalone executable
3. Template validation and caching

### Server Package Build

1. **prebuild**: Clean directories
2. **build**: bunchee compilation to ESM/CJS
3. **postbuild**: Next.js preparation and static asset generation
4. **prepare:py-static**: Python integration assets

### Release Process

```bash
pnpm release     # Build all + publish npm packages + Python release
```

## Development Environment Setup

### Prerequisites

- Node.js >=16.14.0
- Python with uv package manager
- pnpm for package management

### Common Workflow

1. Clone repository and run `pnpm install`
2. For CLI development: work in `packages/create-llama/`
3. For server development: choose TypeScript or Python package
4. Use `pnpm dev` for concurrent development across packages
5. Run `pnpm e2e` to validate changes with generated projects

## Special Considerations

### Template Development

- Changes to templates require rebuilding CLI
- E2E tests validate template functionality across frameworks
- Template caching system speeds up repeated builds

### Cross-package Dependencies

- Server package builds static assets for Python integration
- Version synchronization between TypeScript and Python packages
- Shared UI components and styling across implementations

### Performance

- CLI uses caching for template operations
- Server frameworks support streaming responses
- Background processing for file operations and LlamaCloud integration

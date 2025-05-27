# LlamaIndex Server Examples

This package contains practical examples demonstrating how to use the `@llamaindex/server` package to build chat applications with LlamaIndex workflows.

## Package Overview

The examples package is a collection of standalone TypeScript applications that showcase different features and capabilities of the LlamaIndex Server framework. Each example can be run independently to demonstrate specific functionality.

## Key Features Demonstrated

### 1. Simple Workflow (`simple-workflow/calculator.ts`)

- **Purpose**: Basic agent workflow with tool integration
- **Features**: Calculator agent with add tool, starter questions
- **Key Concepts**: Tool definition with Zod schemas, basic server setup

### 2. Agentic RAG (`agentic-rag/index.ts`)

- **Purpose**: Retrieval-Augmented Generation with document querying
- **Features**: Vector store index, document ingestion, query engine tool, automatic question suggestions
- **Key Concepts**: RAG implementation, source node inclusion, embedding models

### 3. Custom Layout (`custom-layout/index.ts` + `layout/header.tsx`)

- **Purpose**: Custom UI components and layout customization
- **Features**: Weather agent with custom header layout, branded interface
- **Key Concepts**: Layout directory configuration, React component integration

### 4. Development Mode (`devmode/index.ts` + `src/app/workflow.ts`)

- **Purpose**: Live development and hot reloading capabilities
- **Features**: Dev mode panel, workflow file hot reloading, separate workflow file structure
- **Key Concepts**: Development workflow, file watching, modular architecture

## Development Scripts

```bash
# Type checking
pnpm typecheck

# Run development server (defaults to simple-workflow/calculator.ts)
pnpm dev

# Run specific examples
npx nodemon --exec tsx agentic-rag/index.ts
npx nodemon --exec tsx custom-layout/index.ts
npx nodemon --exec tsx devmode/index.ts --ignore src/app/workflow_*.ts  # Dev mode with file watching
```

## Environment Setup

All examples require OpenAI API access:

```bash
export OPENAI_API_KEY=your_openai_api_key
```

## Dependencies

### Core Dependencies

- `@llamaindex/server`: Main server framework (workspace dependency)
- `@llamaindex/workflow`: Workflow engine for agent creation
- `@llamaindex/openai`: OpenAI LLM and embedding integrations
- `@llamaindex/tools`: Tool utilities
- `@llamaindex/readers`: Document readers
- `llamaindex`: Core LlamaIndex library
- `zod`: Schema validation for tools

### Development Dependencies

- `tsx`: TypeScript execution for development
- `nodemon`: File watching and auto-restart
- `typescript`: TypeScript compiler

## Architecture Patterns

### Workflow Factory Pattern

All examples use the workflow factory pattern:

```typescript
const workflowFactory = () => agent({ tools: [...] });
// or
const workflowFactory = async () => { /* setup logic */ return agent({ tools: [...] }); };
```

### Server Configuration

Standard server setup pattern:

```typescript
new LlamaIndexServer({
  workflow: workflowFactory,
  uiConfig: {
    /* UI configuration */
  },
  port: 3000,
}).start();
```

### Tool Definition Pattern

Consistent tool creation with Zod schemas:

```typescript
tool({
  name: "tool_name",
  description: "Tool description",
  parameters: z.object({
    /* parameters */
  }),
  execute: (params) => {
    /* implementation */
  },
});
```

## Example-Specific Features

### Simple Workflow

- Basic arithmetic operations
- Minimal setup for learning
- Demonstrates core workflow concepts

### Agentic RAG

- Document indexing with embeddings
- Vector similarity search
- Source node tracking for citations
- Auto-generated follow-up questions

### Custom Layout

- Custom React components in `layout/` directory
- Branded header with navigation
- Layout directory configuration (`layoutDir: "layout"`)

### Dev Mode

- Live code editing in browser
- Hot reloading of workflow files
- Separate workflow file organization
- Development panel UI

## TypeScript Configuration

- Target: ES2022 with bundler module resolution
- Strict type checking enabled
- Excludes: `node_modules`, `dist`, `custom-layout/layout` (runtime components)
- Output: `dist/` directory

## Development Workflow

1. **Choose Example**: Select appropriate example for your use case
2. **Environment Setup**: Configure OpenAI API key
3. **Run Development Server**: Use `pnpm dev` or specific nodemon commands
4. **Access UI**: Open browser at `http://localhost:3000`
5. **Iterate**: Modify code and see changes in real-time

## Common Patterns

### Agent Creation

All examples use the `agent()` function from `@llamaindex/workflow` with tool arrays.

### UI Configuration

- `starterQuestions`: Predefined questions for user guidance
- `layoutDir`: Custom layout components directory
- `devMode`: Enable development features
- `suggestNextQuestions`: Auto-generate follow-up questions

### Error Handling

Examples demonstrate proper async/await patterns and error handling for LLM operations.

## Integration Points

- **LlamaIndex Core**: Document processing, indexing, querying
- **OpenAI**: LLM and embedding model integration
- **React/Next.js**: Frontend UI components and server-side rendering
- **TypeScript**: Type safety throughout the application stack

This examples package serves as a comprehensive reference for building production-ready chat applications with LlamaIndex workflows.

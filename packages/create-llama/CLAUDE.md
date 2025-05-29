# create-llama Package

## Overview

The `create-llama` package is a CLI tool for creating LlamaIndex-powered applications with one command. It's designed as a project generator that scaffolds various types of RAG (Retrieval-Augmented Generation) applications using different frameworks, databases, and AI model providers.

## Package Structure

### Core Files

- **`index.ts`**: Main CLI entry point using Commander.js for argument parsing
- **`create-app.ts`**: Core application creation logic and orchestration
- **`package.json`**: Package configuration with binary entry point at `./dist/index.js`

### Key Directories

- **`helpers/`**: Utility functions for package management, file operations, and configuration
- **`questions/`**: Interactive prompts for user configuration
- **`templates/`**: Project templates for different frameworks and use cases
- **`e2e/`**: End-to-end tests using Playwright

## Core Functionality

### CLI Interface

The tool accepts numerous command-line options including:

- Framework selection (`--framework`: nextjs, express, fastapi)
- Template type (`--template`: streaming, multiagent, reflex, llamaindexserver)
- Model providers (OpenAI, Anthropic, Groq, Ollama, etc.)
- Vector databases (none, mongo, pg, pinecone, milvus, etc.)
- Data sources (files, web URLs, databases)
- Tools and observability options

### Application Generation Flow

1. **Project validation**: Checks project name validity and directory permissions
2. **Interactive questioning**: Prompts user for configuration if not provided via CLI
3. **Template installation**: Copies and configures appropriate templates
4. **Environment setup**: Creates `.env` files with API keys and configuration
5. **Dependencies**: Installs packages using detected/specified package manager
6. **Post-install actions**: Can run the app, open VSCode, or install dependencies

### Template System

Templates are organized by:

- **Framework**: NextJS (frontend), Express (Node backend), FastAPI (Python backend)
- **Type**: Streaming chat, multiagent workflows, Reflex UI, LlamaIndex server
- **Components**: Engines, loaders, providers, UI components, observability

### Helper Functions

Key helper modules include:

- **Installation**: Package manager detection and dependency installation
- **Data sources**: File copying, web scraping, database connection setup
- **Providers**: Model provider configuration (OpenAI, Anthropic, etc.)
- **Tools**: Integration with external tools (Wikipedia, weather, code generation)
- **Environment**: `.env` file generation with API keys and settings

## Development Commands

### Build & Development

- `npm run build`: Build the CLI using bash script
- `npm run dev`: Watch mode development build
- `npm run clean`: Clean build artifacts and temporary files

### Testing

- `npm run e2e`: Run all end-to-end tests
- `npm run e2e:python`: Test Python-specific templates
- `npm run e2e:typescript`: Test TypeScript-specific templates

### Package Management

- `npm run pack-install`: Create and install local package for testing

## Architecture Notes

### Model Configuration

The tool supports multiple AI providers with a unified `ModelConfig` interface that includes:

- Provider selection and API key management
- Model and embedding model specification
- Dimension configuration for embeddings

### Data Source Handling

Flexible data source configuration supporting:

- Local files and directories
- Web URLs with configurable crawling depth
- Database connections with custom queries
- Automatic file downloading and copying

### Template Flexibility

Templates use a component-based system allowing mix-and-match of:

- Different frameworks (NextJS, Express, FastAPI)
- Various vector databases
- Multiple observability tools
- Configurable tools and integrations

This package serves as the foundation for rapidly prototyping and deploying LlamaIndex applications across different technology stacks and use cases.

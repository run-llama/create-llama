# create-llama

## 0.1.7

### Patch Changes

- 260d37a: Add system prompt env variable for TS
- bbd5b8d: Fix postgres connection leaking issue
- bb53425: Support HTTP proxies by setting the GLOBAL_AGENT_HTTP_PROXY env variable
- 69c2e16: Fix streaming for Express
- 7873bfb: Update Ollama provider to run with the base URL from the environment variable

## 0.1.6

### Patch Changes

- 56537a1: Display PDF files in source nodes

## 0.1.5

### Patch Changes

- 84db798: feat: support display latex in chat markdown

## 0.1.4

### Patch Changes

- 0bc8e75: Use ingestion pipeline for dedicated vector stores (Python only)
- cb1001d: Add ChromaDB vector store

## 0.1.3

### Patch Changes

- 416073d: Directly import vector stores to work with NextJS

## 0.1.2

### Patch Changes

- 056e376: Add support for displaying tool outputs (including weather widget as example)

## 0.1.1

### Patch Changes

- 7bd3ed5: Support Anthropic and Gemini as model providers
- 7bd3ed5: Support new agents from LITS 0.3
- cfb5257: Display events (e.g. retrieving nodes) per chat message

## 0.1.0

### Minor Changes

- f1c3e8d: Add Llama3 and Phi3 support using Ollama

### Patch Changes

- a0dec80: Use `gpt-4-turbo` model as default. Upgrade Python llama-index to 0.10.28
- 753229d: Remove asking for AI models and use defaults instead (OpenAIs GPT-4 Vision Preview and Embeddings v3). Use `--ask-models` CLI parameter to select models.
- 1d78202: Add observability for Python
- 6acccd2: Use poetry run generate to generate embeddings for FastAPI
- 9efcffe: Use Settings object for LlamaIndex configuration
- 418bf9b: refactor: use tsx instead of ts-node
- 1be69a5: Add Qdrant support

## 0.0.32

### Patch Changes

- 625ed4d: Support Astra VectorDB
- 922e0ce: Remove UI question (use shadcn as default). Use `html` UI by calling create-llama with --ui html parameter
- ce2f24d: Update loaders and tools config to yaml format (for Python)
- e8db041: Let user select multiple datasources (URLs, files and folders)
- c06d4af: Add nodes to the response (Python)
- 29b17ee: Allow using agents without any data source
- 665c26c: Add redirect to documentation page when accessing the base URL (FastAPI)
- 78ded9e: Add Dockerfile templates for Typescript and Python
- 99e758f: Merge non-streaming and streaming template to one
- b3f2685: Add support for agent generation for Typescript
- 2739714: Use a database (MySQL or PostgreSQL) as a data source

## 0.0.31

### Patch Changes

- 56faee0: Added windows e2e tests
- 60ed8fe: Added missing environment variable config for URL data source
- 60ed8fe: Fixed tool usage by freezing llama-index package versions

## 0.0.30

### Patch Changes

- 3af6328: Add support for llamaparse using Typescript
- dd92b91: Add fetching llm and embedding models from server
- bac1b43: Add Milvus vector database

## 0.0.29

### Patch Changes

- edd24c2: Add observability with openllmetry
- 403fc6f: Minor bug fixes to improve DX (missing .env value and updated error messages)
- 0f79757: Ability to download community submodules

## 0.0.28

### Patch Changes

- 89a49f4: Add more config variables to .env file
- fdf48dd: Add "Start in VSCode" option to postInstallAction
- fdf48dd: Add devcontainers to generated code

## 0.0.27

### Patch Changes

- 2d29350: Add LlamaParse option when selecting a pdf file or a folder (FastAPI only)
- b354f23: Add embedding model option to create-llama (FastAPI only)

## 0.0.26

### Patch Changes

- 09d532e: feat: generate llama pack project from llama index
- cfdd6db: feat: add pinecone support to create llama
- ef25d69: upgrade llama-index package to version v0.10.7 for create-llama app
- 50dfd7b: update fastapi for CVE-2024-24762

## 0.0.25

### Patch Changes

- d06a85b: Add option to create an agent by selecting tools (Google, Wikipedia)
- 7b7329b: Added latest turbo models for GPT-3.5 and GPT 4

## 0.0.24

### Patch Changes

- ba95ca3: Use condense plus context chat engine for FastAPI as default

## 0.0.23

### Patch Changes

- c680af6: Fixed issues with locating templates path

## 0.0.22

### Patch Changes

- 6dd401e: Add an option to provide an URL and chat with the website data (FastAPI only)
- e9b87ef: Select a folder as data source and support more file types (.pdf, .doc, .docx, .xls, .xlsx, .csv)

## 0.0.20

### Patch Changes

- 27d55fd: Add an option to provide an URL and chat with the website data

## 0.0.19

### Patch Changes

- 3a29a80: Add node_modules to gitignore in Express backends
- fe03aaa: feat: generate llama pack example

## 0.0.18

### Patch Changes

- 88d3b41: fix packaging

## 0.0.17

### Patch Changes

- fa17f7e: Add an option that allows the user to run the generated app
- 9e5d8e1: Add an option to select a local PDF file as data source

## 0.0.16

### Patch Changes

- a73942d: Fix: Bundle mongo dependency with NextJS
- 9492cc6: Feat: Added option to automatically install dependencies (for Python and TS)
- f74dea5: Feat: Show images in chat messages using GPT4 Vision (Express and NextJS only)

## 0.0.15

### Patch Changes

- 8e124e5: feat: support showing image on chat message

## 0.0.14

### Patch Changes

- 2e6b36e: fix: re-organize file structure
- 2b356c8: fix: relative path incorrect

## 0.0.13

### Patch Changes

- Added PostgreSQL vector store (for Typescript and Python)
- Improved async handling in FastAPI

## 0.0.12

### Patch Changes

- 9c5e22a: Added cross-env so frontends with Express/FastAPI backends are working under Windows
- 5ab65eb: Bring Python templates with TS templates to feature parity
- 9c5e22a: Added vector DB selector to create-llama (starting with MongoDB support)

## 0.0.11

### Patch Changes

- 2aeb341: - Added option to create a new project based on community templates
  - Added OpenAI model selector for NextJS projects
  - Added GPT4 Vision support (and file upload)

## 0.0.10

### Patch Changes

- Bugfixes (thanks @marcusschiesser)

## 0.0.9

### Patch Changes

- acfe232: Deployment fixes (thanks @seldo)

## 0.0.8

### Patch Changes

- 8cdb07f: Fix Next deployment (thanks @seldo and @marcusschiesser)

## 0.0.7

### Patch Changes

- 9f9f293: Added more to README and made it easier to switch models (thanks @seldo)

## 0.0.6

### Patch Changes

- 4431ec7: Label bug fix (thanks @marcusschiesser)

## 0.0.5

### Patch Changes

- 25257f4: Fix issue where it doesn't find OpenAI Key when running npm run generate (#182) (thanks @RayFernando1337)

## 0.0.4

### Patch Changes

- 031e926: Update create-llama readme (thanks @logan-markewich)

## 0.0.3

### Patch Changes

- 91b42a3: change version (thanks @marcusschiesser)

## 0.0.2

### Patch Changes

- e2a6805: Hello Create Llama (thanks @marcusschiesser)

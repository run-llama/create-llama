# create-llama

## 0.6.4

### Patch Changes

- 97a7d9b: chore: bump @llamaindex/server 0.3.0 in templates

## 0.6.3

### Patch Changes

- fec752e: refactor: llamacloud configs

## 0.6.2

### Patch Changes

- 28b46be: chore: replace Python examples with llama-deploy
- 93e2abe: fix: unused imports and format

## 0.6.1

### Patch Changes

- 952b5b4: fix: peer deps and sourcemap issues made ts server start fail
- e8004fd: Fix: broken devcontainer due to deleted repo

## 0.6.0

### Minor Changes

- 8fa8c3b: Removed deprecated templates and simplified code

### Patch Changes

- 8fa8c3b: Feat: re-add --ask-models

## 0.5.22

### Patch Changes

- e2486eb: feat: support human in the loop for TS

## 0.5.21

### Patch Changes

- af9ad3c: feat: show document artifact after generating report
- a543a27: feat: bump chat-ui with inline artifact

## 0.5.20

### Patch Changes

- 3ff0a18: fix: default header padding

## 0.5.19

### Patch Changes

- 5fe9e17: support eject to fully customize next folder
- b8a1ff6: Support citation for agentic template (Python)

## 0.5.18

### Patch Changes

- 8d59ef0: Add layout_dir config to the generated python code

## 0.5.17

### Patch Changes

- eee3230: feat: support custom layout

## 0.5.16

### Patch Changes

- 6f75d4a: fix: unsupported language in code gen workflow
- d0618fa: Fix LlamaCloud generate script issue

## 0.5.15

### Patch Changes

- 527075c: Enable dev mode that allows updating code directly in the UI

## 0.5.14

### Patch Changes

- 1df8cfb: Split artifacts use case to document generator and code generator
- 1b5a519: chore: improve dev experience with nodemon
- b3eb0ba: Fix typing check issue
- 556f33c: fix chromadb dependency issue
- 2451539: fix: remove dead generated ai code
- 7a70390: Deprecate pro mode

## 0.5.13

### Patch Changes

- f4ca602: Add artifact use case for Typescript template
- f4ca602: Update typescript use cases to use the new workflow engine

## 0.5.12

### Patch Changes

- 241d82a: Add artifacts use case (python)

## 0.5.11

### Patch Changes

- 3960618: chore: create-llama monorepo
- 8fe5fc2: chore: add llamaindex server package

## 0.5.10

### Patch Changes

- 0a2e12a: Use uv as the default package manager

## 0.5.9

### Patch Changes

- 4bc53ac: Bump new chat ui and update deep research component
- 4bc53ac: Support generate UI for deep research use case (Typescript)

## 0.5.8

### Patch Changes

- 765181a: chore: test typescript e2e with node 20 and 22

## 0.5.7

### Patch Changes

- 5988657: chore: bump llmaindex

## 0.5.6

### Patch Changes

- d363ced: Bump llamaindex server packages

## 0.5.5

### Patch Changes

- ee85320: The default custom deep research component does not work.

## 0.5.4

### Patch Changes

- 7c3b279: Support code generation of event components using an LLM (Python)

## 0.5.3

### Patch Changes

- 76ec360: Update templates to use new chat ui config

## 0.5.2

### Patch Changes

- c9f8f8d: Use custom component for deep research use case

## 0.5.1

### Patch Changes

- 08b3e07: Simplify the local index code.

## 0.5.0

### Minor Changes

- 54c9e2f: Simplified generated code using LlamaIndexServer

### Patch Changes

- 0e4ecfa: fix: add trycatch for generating error
- ee69ce7: bump: chat-ui and tailwind v4

## 0.4.0

### Minor Changes

- 61204a1: chore: bump LITS 0.9

### Patch Changes

- 9e723c3: Standardize the code of the workflow use case (Python)
- d5da55b: feat: add components.json to use CLI
- c1552eb: chore: move wikipedia tool to create-llama

## 0.3.28

### Patch Changes

- 4e06714: Fix the error: Unable to view file sources due to CORS.

## 0.3.27

### Patch Changes

- b4e41aa: Add deep research over own documents use case (Python)

## 0.3.26

### Patch Changes

- f73d46b: Fix missing copy of the multiagent code

## 0.3.25

### Patch Changes

- 5450096: bump: react 19 stable

## 0.3.24

### Patch Changes

- a84743c: Change --agents paramameter to --use-case
- a84743c: Add LlamaCloud support for Reflex templates
- a7a6592: Fix the npm issue on the full-stack Python template
- fc5e56e: bump: code interpreter v1

## 0.3.23

### Patch Changes

- 9077cae: Add contract review use case (Python)

## 0.3.22

### Patch Changes

- 25667d4: Make OpenAPI spec usable by custom GPTs

## 0.3.21

### Patch Changes

- 95227a7: Add query endpoint

## 0.3.20

### Patch Changes

- 27d2499: Bump the LlamaCloud library and fix breaking changes (Python).

## 0.3.19

### Patch Changes

- f9a057d: Add support multimodal indexes (e.g. from LlamaCloud)
- aedd73d: bump: chat-ui

## 0.3.18

### Patch Changes

- fe90a7e: chore: bump ai v4
- 02b2473: Show streaming errors in Python, optimize system prompts for tool usage and set the weather tool as default for the Agentic RAG use case
- 63e961e: Use auto_routed retriever mode for LlamaCloudIndex

## 0.3.17

### Patch Changes

- 28c8808: Add fly.io deployment
- 0a7dfcf: Generate NEXT_PUBLIC_CHAT_API for NextJS backend to specify alternative backend

## 0.3.16

### Patch Changes

- 8b371d8: Set pydantic version to <2.10 to avoid incompatibility with llama-index.
- 30fe269: Deactive duckduckgo tool for TS
- 30fe269: Replace DuckDuckGo by Wikipedia tool for agentic template

## 0.3.15

### Patch Changes

- fc5b266: Improve DX for Python template (use one deployment instead of two)
- f8f97d2: Add support for python 3.13

## 0.3.14

### Patch Changes

- 00f0b3a: fix: dont include user message in chat history
- 4663dec: chore: bump react19 rc
- 44b34fb: chore: update eslint 9, nextjs 15, react 19
- 6925676: feat: use latest chat UI

## 0.3.13

### Patch Changes

- 282eaa0: Ensure that the index and document store are created when uploading a file with no available index.

## 0.3.12

### Patch Changes

- 6edea6a: Optimize generated workflow code for Python
- 8431b78: Optimize Typescript multi-agent code
- 8431b78: Add form filling use case (Typescript)

## 0.3.11

### Patch Changes

- 2b8aaa8: Add support for local models via Hugging Face
- b9570b2: Fix: use generic LLMAgent instead of OpenAIAgent (adds support for Gemini and Anthropic for Agentic RAG)
- 1fe21f8: Fix the highlight.js issue with the Next.js static build
- 00009ae: feat: import pdf css

## 0.3.10

### Patch Changes

- 9172fed: feat: bump LITS 0.8.2
- 78ccde7: feat: use llamaindex chat-ui for nextjs frontend

## 0.3.9

### Patch Changes

- ed59927: Add form filling use case (Python)

## 0.3.8

### Patch Changes

- 4a83469: Add multi-agent financial report for Typescript (and update LITS to 0.7.10)

## 0.3.7

### Patch Changes

- fa80378: DocumentInfo working with relative URLs

## 0.3.6

### Patch Changes

- 0182368: Fix the streaming issue to prevent the UI from hanging.

## 0.3.5

### Patch Changes

- 2209409: Add financial report as the default use case in the multi-agent template (Python).

## 0.3.4

### Patch Changes

- 384a136: Fix import error if the artifact tool is selected

## 0.3.3

### Patch Changes

- 99b8247: Simplify and unify handling file uploads

## 0.3.2

### Patch Changes

- 6d1b6b9: Update README.md for pro mode

## 0.3.1

### Patch Changes

- f3577c5: Fix event streaming is blocked
- f3577c5: Add upload file to sandbox (artifact and code interpreter)

## 0.3.0

### Minor Changes

- 7562cb4: Simplified default questions and added pro mode

### Patch Changes

- 0a69fe0: fix: missing params when init Astra vectorstore
- 98a82b0: docs: chroma env variables

## 0.2.19

### Patch Changes

- 3d41488: feat: use selected llamacloud for multiagent

## 0.2.18

### Patch Changes

- 75e1f61: Fix cannot query public document from llamacloud
- 88220f1: fix workflow doesn't stop when user presses stop generation button
- 75e1f61: Fix typescript templates cannot upload file to llamacloud
- 88220f1: Bump llama_index@0.11.17

## 0.2.17

### Patch Changes

- cd3fcd0: bump: use LlamaIndexTS 0.6.18
- 6335de1: Fix using LlamaCloud selector does not use the configured values in the environment (Python)

## 0.2.16

### Patch Changes

- 0e78ba4: Fix: programmatically ensure index for LlamaCloud
- 0e78ba4: Fix .env not loaded on poetry run generate
- 7f4ac22: Don't need to run generate script for LlamaCloud
- 5263bde: Use selected LlamaCloud index in multi-agent template

## 0.2.15

### Patch Changes

- 16e6124: Bump package for llamatrace observability
- 3790ca0: Add multi-agent task selector for TS template
- d18f039: Add e2b code artifact tool for the FastAPI template

## 0.2.14

### Patch Changes

- 5a7216e: feat: implement artifact tool in TS

## 0.2.13

### Patch Changes

- 04ddebc: Add publisher agent to multi-agents for generating documents (PDF and HTML)
- 04ddebc: Allow tool selection for multi-agents (Python and TS)

## 0.2.12

### Patch Changes

- 70f7dca: feat: add test deps for llamaparse
- ef070c0: Add multi agents template for Typescript

## 0.2.11

### Patch Changes

- 7c2a3f6: fix: postgres import

## 0.2.10

### Patch Changes

- cb8d535: Fix only produces one agent event

## 0.2.9

### Patch Changes

- 0213fe0: Update dependencies for vector stores and add e2e test to ensure that they work as expected.

## 0.2.8

### Patch Changes

- 0031e67: Bump llama-index to 0.11.11 for the multi-agent template

## 0.2.7

### Patch Changes

- 505b8e9: bump: use latest ai package version
- cf3ec97: Dynamically select model for Groq
- 8c1087f: feat: enhance style for markdown

## 0.2.6

### Patch Changes

- adc40cf: fix: vercel ai update crash sending annotations

## 0.2.5

### Patch Changes

- 38a8be8: fix: filter in mongo vector store

## 0.2.4

### Patch Changes

- 917e862: Fix errors in building the frontend

## 0.2.3

### Patch Changes

- b6da3c2: Ensure the generation script always works

## 0.2.2

### Patch Changes

- 8105c5c: Add env config for next questions feature

## 0.2.1

### Patch Changes

- 6a409cb: Bump web and database reader packages

## 0.2.0

### Minor Changes

- 435109f: Add multi-agents template based on workflows

## 0.1.44

### Patch Changes

- bedde2b: Change metadata filters to use already existing documents in LlamaCloud Index
- 5cd12fa: Use one callback manager per request
- 5cd12fa: Bump llama_index version to 0.11.1
- fd4abb3: Fix to use filename for uploaded documents in NextJS
- 2f8feab: Simplify CLI interface

## 0.1.43

### Patch Changes

- 4fa2b76: feat: implement citation for TS

## 0.1.42

### Patch Changes

- 8f670a9: Allow relative URL in documents

## 0.1.41

### Patch Changes

- 57e7638: Use the retrieval defaults from LlamaCloud

## 0.1.40

### Patch Changes

- 8ce4a85: Add UI for extractor template

## 0.1.39

### Patch Changes

- 3fb93c7: Use LlamaCloud pipeline for data ingestion in TS (private file uploads and generate script)

## 0.1.38

### Patch Changes

- bd5e39a: Fix error that files in sub folders of 'data' are not displayed

## 0.1.37

### Patch Changes

- 9fd832c: Add in-text citation references

## 0.1.36

### Patch Changes

- 2b7a5d8: Fix: private file upload not working in Python without LlamaCloud

## 0.1.35

### Patch Changes

- 81ef7f0: Use LlamaCloud pipeline for data ingestion (private file uploads and generate script)

## 0.1.34

### Patch Changes

- c49a5e1: Add error handling for generating the next question
- c49a5e1: Fix wrong api key variable in Azure OpenAI provider

## 0.1.33

### Patch Changes

- d746c75: Add Weaviate vector store (Typescript)

## 0.1.32

### Patch Changes

- 3ec5163: Add Weaviate vector database support (Python)

## 0.1.31

### Patch Changes

- 04a9c71: Cluster nodes by document

## 0.1.30

### Patch Changes

- 09e3022: Add support for LlamaTrace (Python)
- c06ec4f: Fix imports for MongoDB
- b6dd7a9: Always send chat data when submit message

## 0.1.29

### Patch Changes

- 8890e27: Let user change indexes in LlamaCloud projects

## 0.1.28

### Patch Changes

- 9a09e8c: Fix Vercel deployment

## 0.1.27

### Patch Changes

- c5c7eee: Make components reusable for chat-llamaindex

## 0.1.26

### Patch Changes

- f43399c: Add metadatafilters to context chat engine (Typescript)

## 0.1.25

### Patch Changes

- c67daeb: fix: missing set private to false for default generate.py

## 0.1.24

### Patch Changes

- 43474a5: Configure LlamaCloud organization ID for Python
- cf11b23: Add Azure code interpreter for Python and TS
- fd9fb42: Add Azure OpenAI as model provider
- 5c13646: Fix starter questions not working in python backend

## 0.1.23

### Patch Changes

- 6bd76fb: Add template for structured extraction

## 0.1.22

### Patch Changes

- b0becaa: Add e2e testing for llamacloud datasource
- df9cca5: Upgrade pdf viewer

## 0.1.21

### Patch Changes

- bd4714c: Filter private documents for Typescript (Using MetadataFilters) and update to LlamaIndexTS 0.5.7
- 58e6c15: Add using LlamaParse for private file uploader
- 455ab68: Display files in sources using LlamaCloud indexes.
- 23b7357: Use gpt-4o-mini as default model
- 0900413: Add suggestions for next questions.

## 0.1.20

### Patch Changes

- 624c721: Update to LlamaIndex 0.10.55

## 0.1.19

### Patch Changes

- df96159: Use Qdrant FastEmbed as local embedding provider
- 32fb32a: Support upload document files: pdf, docx, txt

## 0.1.18

### Patch Changes

- d1026ea: support Mistral as llm and embedding
- a221cfc: Use LlamaParse for all the file types that it supports (if activated)

## 0.1.17

### Patch Changes

- 9ecd061: Add new template for a multi-agents app

## 0.1.16

### Patch Changes

- a0aab03: Add T-System's LLMHUB as a model provider

## 0.1.15

### Patch Changes

- 64732f0: Fix the issue of images not showing with the sandbox URL from OpenAI's models
- aeb6fef: use llamacloud for chat

## 0.1.14

### Patch Changes

- f2c3389: chore: update to llamaindex 0.4.3
- 5093b37: Remove non-working file selectors for Linux

## 0.1.13

### Patch Changes

- b3c969d: Add image generator tool

## 0.1.12

### Patch Changes

- aa69014: Fix NextJS for TS 5.2

## 0.1.11

### Patch Changes

- 48b96ff: Add DuckDuckGo search tool
- 9c9decb: Reuse function tool instances and improve e2b interpreter tool for Python
- 02ed277: Add Groq as a model provider
- 0748f2e: Remove hard-coded Gemini supported models

## 0.1.10

### Patch Changes

- 9112d08: Add OpenAPI tool for Typescript
- 8f03f8d: Add OLLAMA_REQUEST_TIMEOUT variable to config Ollama timeout (Python)
- 8f03f8d: Apply nest_asyncio for llama parse

## 0.1.9

### Patch Changes

- a42fa53: Add CSV upload
- 563b51d: Fix Vercel streaming (python) to stream data events instantly
- d60b3c5: Add E2B code interpreter tool for FastAPI
- 956538e: Add OpenAPI action tool for FastAPI

## 0.1.8

### Patch Changes

- cd50a33: Add interpreter tool for TS using e2b.dev

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

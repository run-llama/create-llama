# Create Llama

The easiest way to get started with [LlamaIndex](https://www.llamaindex.ai/) is by using `create-llama`. This CLI tool enables you to quickly start building a new LlamaIndex application, with everything set up for you.

## Get started

Just run

```bash
npx create-llama@latest
```

to get started, or watch this video for a demo session:

https://github.com/user-attachments/assets/dd3edc36-4453-4416-91c2-d24326c6c167

Once your app is generated, run

```bash
npm run dev
```

to start the development server. You can then visit [http://localhost:3000](http://localhost:3000) to see your app.

## What you'll get

- A set of pre-configured use cases to get you started, e.g. Agentic RAG, Data Analysis, Report Generation, etc.
- A Next.js-powered front-end using components from [shadcn/ui](https://ui.shadcn.com/). The app is set up as a chat interface that can answer questions about your data or interact with your agent
- Your choice of two back-ends:
  - **Next.js**: if you select this option, you’ll have a full-stack Next.js application that you can deploy to a host like [Vercel](https://vercel.com/) in just a few clicks. This uses [LlamaIndex.TS](https://www.npmjs.com/package/llamaindex), our TypeScript library.
  - **Python FastAPI**: if you select this option, you’ll get a separate backend powered by the [llama-index Python package](https://pypi.org/project/llama-index/), which you can deploy to a service like [Render](https://render.com/) or [fly.io](https://fly.io/). The separate Next.js front-end will connect to this backend.
- Each back-end has two endpoints:
  - One streaming chat endpoint, that allow you to send the state of your chat and receive additional responses
  - One endpoint to upload private files which can be used in your chat
- The app uses OpenAI by default, so you'll need an OpenAI API key, or you can customize it to use any of the dozens of LLMs we support.

Here's how it looks like:

https://github.com/user-attachments/assets/d57af1a1-d99b-4e9c-98d9-4cbd1327eff8

## Using your data

Optionally, you can supply your own data; the app will index it and make use of it, e.g. to answer questions. Your generated app will have a folder called `data` (If you're using Express or Python and generate a frontend, it will be `./backend/data`).

The app will ingest any supported files you put in this directory. Your Next.js and Express apps use LlamaIndex.TS, so they will be able to ingest any PDF, text, CSV, Markdown, Word and HTML files. The Python backend can read even more types, including video and audio files.

Before you can use your data, you need to index it. If you're using the Next.js or Express apps, run:

```bash
npm run generate
```

Then re-start your app. Remember you'll need to re-run `generate` if you add new files to your `data` folder.

If you're using the Python backend, you can trigger indexing of your data by calling:

```bash
poetry run generate
```

## Customizing the AI models

The app will default to OpenAI's `gpt-4o-mini` LLM and `text-embedding-3-large` embedding model.

If you want to use different OpenAI models, add the `--ask-models` CLI parameter.

You can also replace OpenAI with one of our [dozens of other supported LLMs](https://docs.llamaindex.ai/en/stable/module_guides/models/llms/modules.html).

To do so, you have to manually change the generated code (edit the `settings.ts` file for Typescript projects or the `settings.py` file for Python projects)

## Example

The simplest thing to do is run `create-llama` in interactive mode:

```bash
npx create-llama@latest
# or
npm create llama@latest
# or
yarn create llama
# or
pnpm create llama@latest
```

You will be asked for the name of your project, along with other configuration options, something like this:

```bash
>> npm create llama@latest
Need to install the following packages:
  create-llama@latest
Ok to proceed? (y) y
✔ What is your project named? … my-app
✔ What app do you want to build? › Agentic RAG
✔ What language do you want to use? › Python (FastAPI)
✔ Do you want to use LlamaCloud services? … No / Yes
✔ Please provide your LlamaCloud API key (leave blank to skip): …
✔ Please provide your OpenAI API key (leave blank to skip): …
? How would you like to proceed? › - Use arrow-keys. Return to submit.
    Just generate code (~1 sec)
❯   Start in VSCode (~1 sec)
    Generate code and install dependencies (~2 min)
```

### Running non-interactively

You can also pass command line arguments to set up a new project
non-interactively. For a list of the latest options, call `create-llama --help`.

### Running in pro mode

If you prefer more advanced customization options, you can run `create-llama` in pro mode using the `--pro` flag.

In pro mode, instead of selecting a predefined use case, you'll be prompted to select each technical component of your project. This allows for greater flexibility in customizing your project, including:

- **Vector Store**: Choose from a variety of vector stores for keeping your documents, including MongoDB, Pinecone, Weaviate, Qdrant and Chroma.
- **Tools**: Choose from a variety of agent tools (functions called by the LLM), such as:
  - Code Interpreter: Executes Python code in a secure Jupyter notebook environment
  - Artifact Code Generator: Generates code artifacts that can be run in a sandbox
  - OpenAPI Action: Facilitates requests to a provided OpenAPI schema
  - Image Generator: Creates images based on text descriptions
  - Web Search: Performs web searches to retrieve up-to-date information
- **Data Sources**: Integrate various data sources into your chat application, including local files, websites, or database-retrieved data.
- **Backend Options**: Besides using Next.js or FastAPI, you can also select to use Express for a more traditional Node.js application.
- **Observability**: Choose from a variety of LLM observability tools, including LlamaTrace and Traceloop.

Pro mode is ideal for developers who want fine-grained control over their project's configuration and are comfortable with more technical setup options.

## LlamaIndex Documentation

- [TS/JS docs](https://ts.llamaindex.ai/)
- [Python docs](https://docs.llamaindex.ai/en/stable/)

Inspired by and adapted from [create-next-app](https://github.com/vercel/next.js/tree/canary/packages/create-next-app)

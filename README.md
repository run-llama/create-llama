# Create LlamaIndex App

The easiest way to get started with [LlamaIndex](https://www.llamaindex.ai/) is by using `create-llama`. This CLI tool enables you to quickly start building a new LlamaIndex application, with everything set up for you.

Just run

```bash
npx create-llama@latest
```

to get started, or see below for more options. Once your app is generated, run

```bash
npm run dev
```

to start the development server. You can then visit [http://localhost:3000](http://localhost:3000) to see your app.

## What you'll get

- A Next.js-powered front-end using components from [shadcn/ui](https://ui.shadcn.com/). The app is set up as a chat interface that can answer questions about your data (see below)
- Your choice of 3 back-ends:
  - **Next.js**: if you select this option, you’ll have a full-stack Next.js application that you can deploy to a host like [Vercel](https://vercel.com/) in just a few clicks. This uses [LlamaIndex.TS](https://www.npmjs.com/package/llamaindex), our TypeScript library.
  - **Express**: if you want a more traditional Node.js application you can generate an Express backend. This also uses LlamaIndex.TS.
  - **Python FastAPI**: if you select this option, you’ll get a backend powered by the [llama-index python package](https://pypi.org/project/llama-index/), which you can deploy to a service like Render or fly.io.
- The back-end has two endpoints (one streaming, the other one non-streaming) that allow you to send the state of your chat and receive additional responses
- You add arbitrary data sources to your chat, like local files, websites, or data retrieved from a database.
- Turn your chat into an AI agent by adding tools (functions called by the LLM).
- The app uses OpenAI by default, so you'll need an OpenAI API key, or you can customize it to use any of the dozens of LLMs we support.

## Using your data

You can supply your own data; the app will index it and answer questions. Your generated app will have a folder called `data` (If you're using Express or Python and generate a frontend, it will be `./backend/data`).

The app will ingest any supported files you put in this directory. Your Next.js and Express apps use LlamaIndex.TS so they will be able to ingest any PDF, text, CSV, Markdown, Word and HTML files. The Python backend can read even more types, including video and audio files.

Before you can use your data, you need to index it. If you're using the Next.js or Express apps, run:

```bash
npm run generate
```

Then re-start your app. Remember you'll need to re-run `generate` if you add new files to your `data` folder.

If you're using the Python backend, you can trigger indexing of your data by calling:

```bash
poetry run generate
```

## Want a front-end?

Optionally generate a frontend if you've selected the Python or Express back-ends. If you do so, `create-llama` will generate two folders: `frontend`, for your Next.js-based frontend code, and `backend` containing your API.

## Customizing the AI models

The app will default to OpenAI's `gpt-4-turbo` LLM and `text-embedding-3-large` embedding model.

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
✔ Which template would you like to use? › Chat
✔ Which framework would you like to use? › NextJS
✔ Would you like to set up observability? › No
✔ Please provide your OpenAI API key (leave blank to skip): …
✔ Which data source would you like to use? › Use an example PDF
✔ Would you like to add another data source? › No
✔ Would you like to use LlamaParse (improved parser for RAG - requires API key)? … no / yes
✔ Would you like to use a vector database? › No, just store the data in the file system
? How would you like to proceed? › - Use arrow-keys. Return to submit.
   Just generate code (~1 sec)
❯  Start in VSCode (~1 sec)
   Generate code and install dependencies (~2 min)
   Generate code, install dependencies, and run the app (~2 min)
```

### Running non-interactively

You can also pass command line arguments to set up a new project
non-interactively. See `create-llama --help`:

```bash
create-llama <project-directory> [options]

Options:
  -V, --version                      output the version number

  --use-npm

    Explicitly tell the CLI to bootstrap the app using npm

  --use-pnpm

    Explicitly tell the CLI to bootstrap the app using pnpm

  --use-yarn

    Explicitly tell the CLI to bootstrap the app using Yarn

```

## LlamaIndex Documentation

- [TS/JS docs](https://ts.llamaindex.ai/)
- [Python docs](https://docs.llamaindex.ai/en/stable/)

Inspired by and adapted from [create-next-app](https://github.com/vercel/next.js/tree/canary/packages/create-next-app)

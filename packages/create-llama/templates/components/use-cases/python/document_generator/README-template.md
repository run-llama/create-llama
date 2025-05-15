This is a [LlamaIndex](https://www.llamaindex.ai/) project using [Workflows](https://docs.llamaindex.ai/en/stable/understanding/workflows/).

## Getting Started

First, setup the environment with uv:

> **_Note:_** This step is not needed if you are using the dev-container.

```shell
uv sync
```

Then check the parameters that have been pre-configured in the `.env` file in this directory.
Make sure you have set the `OPENAI_API_KEY` for the LLM.

Then, run the development server:

```shell
uv run fastapi dev
```

Then open [http://localhost:8000](http://localhost:8000) with your browser to start the chat UI.

To start the app optimized for **production**, run:

```
uv run fastapi run
```

## Configure LLM and Embedding Model

You can configure [LLM model](https://docs.llamaindex.ai/en/stable/module_guides/models/llms) and [embedding model](https://docs.llamaindex.ai/en/stable/module_guides/models/embeddings) in [settings.py](app/settings.py).

## Use Case

AI-powered document generator that can help you generate documents with a chat interface and simple markdown editor.

To update the workflow, you can modify the code in [`workflow.py`](app/workflow.py).

You can start by sending an request on the [chat UI](http://localhost:8000) or you can test the `/api/chat` endpoint with the following curl request:

```
curl --location 'localhost:8000/api/chat' \
--header 'Content-Type: application/json' \
--data '{ "messages": [{ "role": "user", "content": "Create a report comparing the finances of Apple and Tesla" }] }'
```

## Customize the UI

To customize the UI, you can start by modifying the [./components/ui_event.jsx](./components/ui_event.jsx) file.

You can also generate a new code for the workflow using LLM by running the following command:

```
uv run generate_ui
```

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex.
- [Workflows Introduction](https://docs.llamaindex.ai/en/stable/understanding/workflows/) - learn about LlamaIndex workflows.
- [LlamaIndex Server](https://pypi.org/project/llama-index-server/)

You can check out [the LlamaIndex GitHub repository](https://github.com/run-llama/llama_index) - your feedback and contributions are welcome!

This is a [LlamaIndex](https://www.llamaindex.ai/) project using [FastAPI](https://fastapi.tiangolo.com/) bootstrapped with [`create-llama`](https://github.com/run-llama/LlamaIndexTS/tree/main/packages/create-llama).

## Getting Started

First, setup the environment with poetry:

> **_Note:_** This step is not needed if you are using the dev-container.

```shell
poetry install
poetry shell
```

Then check the parameters that have been pre-configured in the `.env` file in this directory. (E.g. you might need to configure an `OPENAI_API_KEY` if you're using OpenAI as model provider).

Second, generate the embeddings of the documents in the `./data` directory (if this folder exists - otherwise, skip this step):

```shell
poetry run generate
```

Third, run all the services in one command:

```shell
poetry run python main.py
```

You can monitor and test the agent services with `llama-agents` monitor TUI:

```shell
poetry run llama-agents monitor --control-plane-url http://127.0.0.1:8001
```

## Services:

- Message queue (port 8000): To exchange the message between services
- Control plane (port 8001): A gateway to manage the tasks and services.
- Human consumer (port 8002): To handle result when the task is completed.
- Agent service `query_engine` (port 8003): Agent that can query information from the configured LlamaIndex index.
- Agent service `dummy_agent` (port 8004): A dummy agent that does nothing. Good starting point to add more agents.

The ports listed above are set by default, but you can change them in the `.env` file.

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex.

You can check out [the LlamaIndex GitHub repository](https://github.com/run-llama/llama_index) - your feedback and contributions are welcome!

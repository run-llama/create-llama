This is a [LlamaIndex](https://www.llamaindex.ai/) multi-agents project using [Workflows](https://docs.llamaindex.ai/en/stable/understanding/workflows/).

## Getting Started

First, setup the environment with poetry:

> **_Note:_** This step is not needed if you are using the dev-container.

```shell
poetry install
```

Then check the parameters that have been pre-configured in the `.env` file in this directory. (E.g. you might need to configure an `OPENAI_API_KEY` if you're using OpenAI as model provider and `E2B_API_KEY` for the [E2B's code interpreter tool](https://e2b.dev/docs)).

Second, generate the embeddings of the documents in the `./data` directory:

```shell
poetry run generate
```

Third, run the development server:

```shell
poetry run python main.py
```

The example provides one streaming API endpoint `/api/chat`.
You can test the endpoint with the following curl request:

```
curl --location 'localhost:8000/api/chat' \
--header 'Content-Type: application/json' \
--data '{ "messages": [{ "role": "user", "content": "Create a report comparing the finances of Apple and Tesla" }] }'
```

You can start editing the API by modifying `app/api/routers/chat.py` or `app/financial_report/workflow.py`. The API auto-updates as you save the files.

Open [http://localhost:8000/docs](http://localhost:8000/docs) with your browser to see the Swagger UI of the API.

The API allows CORS for all origins to simplify development. You can change this behavior by setting the `ENVIRONMENT` environment variable to `prod`:

```
ENVIRONMENT=prod poetry run python main.py
```

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex.
- [Workflows Introduction](https://docs.llamaindex.ai/en/stable/understanding/workflows/) - learn about LlamaIndex workflows.

You can check out [the LlamaIndex GitHub repository](https://github.com/run-llama/llama_index) - your feedback and contributions are welcome!

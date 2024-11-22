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
poetry run dev
```

The example provides one streaming API endpoint `/api/chat`.
You can test the endpoint with the following curl request:

```
curl --location 'localhost:8000/api/chat' \
--header 'Content-Type: application/json' \
--data '{ "messages": [{ "role": "user", "content": "Create a report comparing the finances of Apple and Tesla" }] }'
```

You can start editing the API by modifying `app/api/routers/chat.py` or `app/workflows/financial_report.py`. The API auto-updates as you save the files.

Open [http://localhost:8000](http://localhost:8000) with your browser to start the app.

To start the app optimized for **production**, run:

```
poetry run prod
```

## Deployments

For production deployments, check the [DEPLOY.md](DEPLOY.md) file.

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex.
- [Workflows Introduction](https://docs.llamaindex.ai/en/stable/understanding/workflows/) - learn about LlamaIndex workflows.

You can check out [the LlamaIndex GitHub repository](https://github.com/run-llama/llama_index) - your feedback and contributions are welcome!

This is a [LlamaIndex](https://www.llamaindex.ai/) project using [Reflex](https://reflex.dev/) bootstrapped with [`create-llama`](https://github.com/run-llama/LlamaIndexTS/tree/main/packages/create-llama) featuring [structured extraction](https://docs.llamaindex.ai/en/stable/examples/structured_outputs/structured_outputs/?h=structured+output) in a RAG pipeline.

## Getting Started

First, setup the environment with poetry:

> **_Note:_** This step is not needed if you are using the dev-container.

```shell
uv sync
```

Then check the parameters that have been pre-configured in the `.env` file in this directory. (E.g. you might need to configure an `OPENAI_API_KEY` if you're using OpenAI as model provider).

Second, generate the embeddings of the example document in the `./data` directory:

```shell
uv run generate
```

Third, start app with `reflex` command:

```shell
uv run reflex run
```

To deploy the application, refer to the Reflex deployment guide: https://reflex.dev/docs/hosting/deploy-quick-start/

### UI

You can now access the UI at http://localhost:3000 to test the structure extractor interactively.

It allows you to remove and add your own documents, modify the Pydantic model used for structured extraction, and test the RAG pipeline with different queries.

For example, keep the provided Pydantic model and query: "What is the maximum weight for a parcel?".

> Note: the Pydantic model used is the last element in the code provided by the user.

### API

Alternatively, check the API documentation at http://localhost:8000/docs. This example provides the `/api/extractor/query` API endpoint.
Per default, the query endpoint returns structured data in the format of the model [DEFAULT_MODEL](./app/services/model.py) class. Modify this class to change the output format.

You can test the endpoint with the following curl request:

```shell
curl --location 'localhost:8000/api/extractor/query' \
--header 'Content-Type: application/json' \
--data '{ "query": "What is the maximum weight for a parcel?" }'
```

Which will return a response that the RAG pipeline is confident about the answer.

Try

```shell
curl --location 'localhost:8000/api/extractor/query' \
--header 'Content-Type: application/json' \
--data '{ "query": "What is the weather today?" }'
```

To retrieve a response with low confidence since the question is not related to the provided document in the `./data` directory.

### Development

You can start editing the behavior by modifying the [`ExtractorService`](./app/services/extractor.py). The app auto-updates as you save the file.

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex.

You can check out [the LlamaIndex GitHub repository](https://github.com/run-llama/llama_index) - your feedback and contributions are welcome!

This is a [LlamaIndex](https://www.llamaindex.ai/) project using [Reflex](https://reflex.dev/) bootstrapped with [`create-llama`](https://github.com/run-llama/LlamaIndexTS/tree/main/packages/create-llama) featuring [structured extraction](https://docs.llamaindex.ai/en/stable/examples/structured_outputs/structured_outputs/?h=structured+output).

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

Third, start app with `reflex` command:

```shell
poetry run reflex run
```

You now can access the UI at http://localhost:3000 to testing the structure extractor interactively.  
Or checking the API documentation at: http://localhost:8000/docs. The example provides the `/api/extractor/query` API endpoint.
This query endpoint returns structured data in the format of the [Output](./app/api/routers/output.py) class. Modify this class to change the output format.

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

You can start editing the API endpoint by modifying [`extractor.py`](./app/api/routers/extractor.py). The endpoints auto-update as you save the file.

The API allows CORS for all origins to simplify development. You can change this behavior by setting the `ENVIRONMENT` environment variable to `prod`:

```
poetry run reflex run --env prod
```

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex.

You can check out [the LlamaIndex GitHub repository](https://github.com/run-llama/llama_index) - your feedback and contributions are welcome!

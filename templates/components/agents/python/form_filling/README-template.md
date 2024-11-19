This is a [LlamaIndex](https://www.llamaindex.ai/) multi-agents project using [Workflows](https://docs.llamaindex.ai/en/stable/understanding/workflows/).

## Getting Started

First, setup the environment with poetry:

> **_Note:_** This step is not needed if you are using the dev-container.

```shell
poetry install
```

Then check the parameters that have been pre-configured in the `.env` file in this directory.
Make sure you have the `OPENAI_API_KEY` set.

Second, run the development server:

```shell
poetry run dev
```

## Use Case: Filling Financial CSV Template

To reproduce the use case, start the [frontend](../frontend/README.md) and follow these steps in the frontend:

1. Upload the Apple and Tesla financial reports from the [data](./data) directory. Just send an empty message.
2. Upload the CSV file [sec_10k_template.csv](./sec_10k_template.csv) and send the message "Fill the missing cells in the CSV file".

The agent will fill the missing cells by retrieving the information from the uploaded financial reports and return a new CSV file with the filled cells.

### API endpoints

The example provides one streaming API endpoint `/api/chat`.
You can test the endpoint with the following curl request:

```
curl --location 'localhost:8000/api/chat' \
--header 'Content-Type: application/json' \
--data '{ "messages": [{ "role": "user", "content": "What can you do?" }] }'
```

You can start editing the API by modifying `app/api/routers/chat.py` or `app/workflows/form_filling.py`. The API auto-updates as you save the files.

Open [http://localhost:8000/docs](http://localhost:8000/docs) with your browser to see the Swagger UI of the API.

The API allows CORS for all origins to simplify development. For **production**, you should run:

```
poetry run prod
```

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex.
- [Workflows Introduction](https://docs.llamaindex.ai/en/stable/understanding/workflows/) - learn about LlamaIndex workflows.

You can check out [the LlamaIndex GitHub repository](https://github.com/run-llama/llama_index) - your feedback and contributions are welcome!

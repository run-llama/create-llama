This is a [LlamaIndex](https://www.llamaindex.ai/) project using [FastAPI](https://fastapi.tiangolo.com/) bootstrapped with [`create-llama`](https://github.com/run-llama/LlamaIndexTS/tree/main/packages/create-llama).

## Getting Started

First, setup the environment with poetry:

> **_Note:_** This step is not needed if you are using the dev-container.

```
poetry install
poetry shell
```

By default, we use the OpenAI LLM (though you can customize, see `app/settings.py`). As a result, you need to specify an `OPENAI_API_KEY` in an .env file in this directory.

Example `.env` file:

```
OPENAI_API_KEY=<openai_api_key>
```

If you are using any tools or data sources, you can update their config files in the `config` folder.

Second, generate the embeddings of the documents in the `./data` directory (if this folder exists - otherwise, skip this step):

```
python app/engine/generate.py
```

Third, run the development server:

```
python main.py
```

The example provides two different API endpoints:

1. `/api/chat` - a streaming chat endpoint
2. `/api/chat/request` - a non-streaming chat endpoint

You can test the streaming endpoint with the following curl request:

```
curl --location 'localhost:8000/api/chat' \
--header 'Content-Type: application/json' \
--data '{ "messages": [{ "role": "user", "content": "Hello" }] }'
```

And for the non-streaming endpoint run:

```
curl --location 'localhost:8000/api/chat/request' \
--header 'Content-Type: application/json' \
--data '{ "messages": [{ "role": "user", "content": "Hello" }] }'
```

You can start editing the API endpoints by modifying `app/api/routers/chat.py`. The endpoints auto-update as you save the file. You can delete the endpoint you're not using.

Open [http://localhost:8000/docs](http://localhost:8000/docs) with your browser to see the Swagger UI of the API.

The API allows CORS for all origins to simplify development. You can change this behavior by setting the `ENVIRONMENT` environment variable to `prod`:

```
ENVIRONMENT=prod python main.py
```

## Using docker

1. Build an image for FastAPI app:

```
docker build -t <your_backend_image_name> .
```

2. Start the app:

- Generate embedding for index data:

```
docker run \
  --rm \
  -v $(pwd)/.env:/app/.env \ # Use ENV variables and configuration from your file-system
  -v $(pwd)/config:/app/config \
  -v $(pwd)/storage:/app/storage \ # Use your file system to store gea vector database
  <your_backend_image_name> \
  python app/engine/generate.py
```

- Start the API:

```
docker run \
  -v $(pwd)/.env:/app/.env \ # Use ENV variables and configuration from your file-system
  -v $(pwd)/config:/app/config \
  -v $(pwd)/storage:/app/storage \ # Use your file system to store gea vector database
  -p 8000:8000 \
  <your_backend_image_name>
```

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex.

You can check out [the LlamaIndex GitHub repository](https://github.com/run-llama/llama_index) - your feedback and contributions are welcome!

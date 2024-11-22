This is a [LlamaIndex](https://www.llamaindex.ai/) project using [FastAPI](https://fastapi.tiangolo.com/) bootstrapped with [`create-llama`](https://github.com/run-llama/LlamaIndexTS/tree/main/packages/create-llama).

## Getting Started

First, setup the environment with poetry:

> **_Note:_** This step is not needed if you are using the dev-container.

```
poetry install
poetry shell
```

Then check the parameters that have been pre-configured in the `.env` file in this directory. (E.g. you might need to configure an `OPENAI_API_KEY` if you're using OpenAI as model provider).

If you are using any tools or data sources, you can update their config files in the `config` folder.

Second, generate the embeddings of the documents in the `./data` directory (if this folder exists - otherwise, skip this step):

```
poetry run generate
```

Third, run the app:

```
poetry run dev
```

Open [http://localhost:8000](http://localhost:8000) with your browser to start the app.

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

To start the app optimized for **production**, run:

```
poetry run prod
```

## Deployments

### Deploy locally with Docker

1. Build an image for the FastAPI app:

```
docker build -t <your_backend_image_name> .
```

2. Generate embeddings:

```
docker run \
  --rm \
  -v $(pwd)/.env:/app/.env \ # Use ENV variables and configuration from your file-system
  -v $(pwd)/config:/app/config \
  -v $(pwd)/data:/app/data \ # Use your local folder to read the data
  -v $(pwd)/storage:/app/storage \ # Use your file system to store the vector database
  <your_backend_image_name> \
  poetry run generate
```

3. Start the API:

```
docker run \
  -v $(pwd)/.env:/app/.env \ # Use ENV variables and configuration from your file-system
  -v $(pwd)/config:/app/config \
  -v $(pwd)/storage:/app/storage \ # Use your file system to store gea vector database
  -p 8000:8000 \
  <your_backend_image_name>
```

### Deploy to [Fly.io](https://fly.io/):

First, check out the [flyctl installation guide](https://fly.io/docs/flyctl/install/) and install it to your machine then authenticate with your Fly.io account:

```shell
fly login
```

Then, run this command and follow the prompts to deploy the app.:

```shell
fly launch --internal-port 8000
```

- Notes:
  The deployment will use the values from the `.env` file by default. Make sure all the needed environment variables in the [.env](.env) file (e.g. `OPENAI_API_KEY`) are set.

  To override the values, you can use the environment variables setting in the Fly.io dashboard or using the `fly set` command. For more information, check out the [Environment Configuration](https://fly.io/docs/rails/the-basics/configuration/).

After the app started successfully, you might need to execute the `generate` command remotely to generate embeddings of the documents in the `./data` directory (if this folder exists - otherwise, skip this step):

```
fly console --machine <machine_id> --command "poetry run generate"
```

Where `machine_id` is the ID of the machine where the app is running. You can show the running machines with the `fly machines` command.

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex.

You can check out [the LlamaIndex GitHub repository](https://github.com/run-llama/llama_index) - your feedback and contributions are welcome!

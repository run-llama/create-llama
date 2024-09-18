This is a [LlamaIndex](https://www.llamaindex.ai/) project using [Express](https://expressjs.com/) bootstrapped with [`create-llama`](https://github.com/run-llama/LlamaIndexTS/tree/main/packages/create-llama).

## Getting Started

First, install the dependencies:

```
npm install
```

Second, generate the embeddings of the documents in the `./data` directory (if this folder exists - otherwise, skip this step):

```
npm run generate
```

Third, run the development server:

```
npm run dev
```

The example provides two different API endpoints:

1. `/api/chat` - a streaming chat endpoint (found in `src/controllers/chat.controller.ts`)
2. `/api/chat/request` - a non-streaming chat endpoint (found in `src/controllers/chat-request.controller.ts`)

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

You can start editing the API by modifying `src/controllers/chat.controller.ts` or `src/controllers/chat-request.controller.ts`. The endpoint auto-updates as you save the file.
You can delete the endpoint that you're not using.

## Production

First, build the project:

```
npm run build
```

You can then run the production server:

```
NODE_ENV=production npm run start
```

> Note that the `NODE_ENV` environment variable is set to `production`. This disables CORS for all origins.

## Using Docker

1. Build an image for the Express API:

```
docker build -t <your_backend_image_name> .
```

2. Generate embeddings:

Parse the data and generate the vector embeddings if the `./data` folder exists - otherwise, skip this step:

```
docker run --rm \
  -v $(pwd)/.env:/app/.env \ # Use ENV variables and configuration from your file-system
  -v $(pwd)/config:/app/config \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/cache:/app/cache \ # Use your file system to store the vector database
  <your_backend_image_name>
  npm run generate
```

3. Start the API:

```
docker run \
  -v $(pwd)/.env:/app/.env \ # Use ENV variables and configuration from your file-system
  -v $(pwd)/config:/app/config \
  -v $(pwd)/cache:/app/cache \ # Use your file system to store the vector database
  -p 8000:8000 \
  <your_backend_image_name>
```

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex (Python features).
- [LlamaIndexTS Documentation](https://ts.llamaindex.ai) - learn about LlamaIndex (Typescript features).

You can check out [the LlamaIndexTS GitHub repository](https://github.com/run-llama/LlamaIndexTS) - your feedback and contributions are welcome!

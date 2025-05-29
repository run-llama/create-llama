This is a [LlamaIndex](https://www.llamaindex.ai/) project bootstrapped with [`create-llama`](https://github.com/run-llama/LlamaIndexTS/tree/main/packages/create-llama).

## Getting Started

First, install the dependencies:

```
npm install
```

Then check the parameters that have been pre-configured in the `.env` file in this directory.
Make sure you have set the `OPENAI_API_KEY` for the LLM and the `E2B_API_KEY` for the code interpreter. You can get the E2B API key from [here](https://e2b.dev).

Second, generate the embeddings of the example documents in the `./data` directory:

```
npm run generate
```

Third, run the development server:

```
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the chat UI.

## Configure LLM and Embedding Model

You can configure [LLM model](https://ts.llamaindex.ai/docs/llamaindex/modules/llms) and [embedding model](https://ts.llamaindex.ai/docs/llamaindex/modules/embeddings) in the [settings file](src/app/settings.ts).

## Use Case

We have prepared an [example workflow](./src/app/workflow.ts) for the financial report generation use case, where you can request for the app to generate a financial report using the example documents in the [./data](./data).

You can start by sending an request on the [chat UI](http://localhost:3000) or you can test the `/api/chat` endpoint with the following curl request:

```shell
curl --location 'localhost:3000/api/chat' \
--header 'Content-Type: application/json' \
--data '{ "messages": [{ "role": "user", "content": "Generate a financial report that compares the financial performance of Apple and Tesla" }] }'
```

## Eject Mode

If you want to fully customize the server UI and routes, you can use `npm eject`. It will create a normal Next.js project with the same functionality as @llamaindex/server.

```bash
npm run eject
```

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex (Python features).
- [LlamaIndexTS Documentation](https://ts.llamaindex.ai/docs/llamaindex) - learn about LlamaIndex (Typescript features).
- [Workflows Introduction](https://ts.llamaindex.ai/docs/llamaindex/modules/workflows) - learn about LlamaIndexTS workflows.

You can check out [the LlamaIndexTS GitHub repository](https://github.com/run-llama/LlamaIndexTS) - your feedback and contributions are welcome!

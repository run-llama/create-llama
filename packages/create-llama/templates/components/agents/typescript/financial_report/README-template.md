This is a [LlamaIndex](https://www.llamaindex.ai/) project using [Next.js](https://nextjs.org/) bootstrapped with [`create-llama`](https://github.com/run-llama/LlamaIndexTS/tree/main/packages/create-llama).

## Getting Started

First, install the dependencies:

```
npm install
```

Then check the parameters that have been pre-configured in the `.env` file in this directory.
Make sure you have the `OPENAI_API_KEY` set.

Second, generate the embeddings of the documents in the `./data` directory:

```
npm run generate
```

Third, run the development server:

```
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the chat UI.

## Use Case: Filling Financial CSV Template

You can start by sending an request on the chat UI to create a report comparing the finances of Apple and Tesla.
Or you can test the `/api/chat` endpoint with the following curl request:

```
curl --location 'localhost:3000/api/chat' \
--header 'Content-Type: application/json' \
--data '{ "messages": [{ "role": "user", "content": "Create a report comparing the finances of Apple and Tesla" }] }'
```

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex (Python features).
- [LlamaIndexTS Documentation](https://ts.llamaindex.ai/docs/llamaindex) - learn about LlamaIndex (Typescript features).
- [Workflows Introduction](https://ts.llamaindex.ai/docs/llamaindex/guide/workflow) - learn about LlamaIndexTS workflows.

You can check out [the LlamaIndexTS GitHub repository](https://github.com/run-llama/LlamaIndexTS) - your feedback and contributions are welcome!

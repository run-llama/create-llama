This is a [LlamaIndex](https://www.llamaindex.ai/) project bootstrapped with [`create-llama`](https://github.com/run-llama/LlamaIndexTS/tree/main/packages/create-llama).

## Getting Started

First, install the dependencies:

```
npm install
```

Second, run the development server:

```
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the chat UI.

## Configure LLM and Embedding Model

You can configure [LLM model](https://ts.llamaindex.ai/docs/llamaindex/modules/llms) in the [settings file](src/app/settings.ts).

## Custom UI Components

We have a custom component located in `components/ui_event.jsx`. This is used to display the state of artifact workflows in UI. You can regenerate a new UI component from the workflow event schema by running the following command:

```
npm run generate:ui
```

## Use Case

AI-powered document generator that can help you generate documents with a chat interface and simple markdown editor.

To update the workflow, you can modify the code in [`workflow.ts`](app/workflow.ts).

You can start by sending a request on the [chat UI](http://localhost:3000) or you can test the `/api/chat` endpoint with the following curl request:

```shell
curl --location 'localhost:3000/api/chat' \
--header 'Content-Type: application/json' \
--data '{ "messages": [{ "role": "user", "content": "Compare the financial performance of Apple and Tesla" }] }'
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

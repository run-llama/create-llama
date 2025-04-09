This is a [LlamaIndex](https://www.llamaindex.ai/) project bootstrapped with [`create-llama`](https://github.com/run-llama/LlamaIndexTS/tree/main/packages/create-llama).

## Getting Started

First, install the dependencies:

```
npm install
```

Then check the parameters that have been pre-configured in the `.env` file in this directory.
Make sure you have set the `OPENAI_API_KEY` for the LLM.

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

## Custom UI Components

The LlamaIndex server provides support for custom UI components, allowing you add UI components for specific events in your workflow. This is particularly useful for displaying information or visualizations related to the events that occur during the execution of your workflow.

To enable custom UI components, you need to initialize the LlamaIndex server with a component directory:

```python
new LlamaIndexServer({
  workflow: workflowFactory,
  appTitle: "LlamaIndex App",
  componentsDir: "output/components",
}).start();
```

Add the custom component code to the directory following the naming pattern:

- File Extension: `.jsx` for React components
- File Name: Should match the event type from your workflow (e.g., `deep_research_event.jsx` for handling `deep_research_event` type)
- Component Name: Export a default React component named `Component` that receives props from the event data

Example component structure:

```jsx
function Component({ events }) {
    // Your component logic here
    return (
        // Your JSX here
    );
}
```

## Use Case

We have prepared an [example workflow](./src/app/workflow.ts) for the Deep Research use case, where you can request a detailed answer about the example documents in the [./data](./data) directory.

You can start by sending an request on the [chat UI](http://localhost:3000) or you can test the `/api/chat` endpoint with the following curl request:

```shell
curl --location 'localhost:3000/api/chat' \
--header 'Content-Type: application/json' \
--data '{ "messages": [{ "role": "user", "content": "Compare the financial performance of Apple and Tesla" }] }'
```

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex (Python features).
- [LlamaIndexTS Documentation](https://ts.llamaindex.ai/docs/llamaindex) - learn about LlamaIndex (Typescript features).
- [Workflows Introduction](https://ts.llamaindex.ai/docs/llamaindex/modules/workflows) - learn about LlamaIndexTS workflows.

You can check out [the LlamaIndexTS GitHub repository](https://github.com/run-llama/LlamaIndexTS) - your feedback and contributions are welcome!

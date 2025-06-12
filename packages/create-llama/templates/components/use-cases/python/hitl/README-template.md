This is a [LlamaIndex](https://www.llamaindex.ai/) project using [Workflows](https://docs.llamaindex.ai/en/stable/understanding/workflows/).

## Getting Started

First, setup the environment with uv:

> **_Note:_** This step is not needed if you are using the dev-container.

```shell
uv sync
```

Then check the parameters that have been pre-configured in the `.env` file in this directory.
Make sure you have set the `OPENAI_API_KEY` for the LLM.

Then, run the development server:

```shell
uv run fastapi dev
```

Then open [http://localhost:8000](http://localhost:8000) with your browser to start the chat UI.

To start the app optimized for **production**, run:

```
uv run fastapi run
```

## Configure LLM and Embedding Model

You can configure [LLM model](https://docs.llamaindex.ai/en/stable/module_guides/models/llms) and [embedding model](https://docs.llamaindex.ai/en/stable/module_guides/models/embeddings) in [settings.py](app/settings.py).

## Use Case

This example shows how to use the LlamaIndexServer with a human in the loop. It allows you to start CLI commands that are reviewed by a human before execution.

To update the workflow, you can modify the code in [`workflow.py`](app/workflow.py).

You can start by sending an request on the [chat UI](http://localhost:8000) or you can test the `/api/chat` endpoint with the following curl request:

```
curl --location 'localhost:8000/api/chat' \
--header 'Content-Type: application/json' \
--data '{ "messages": [{ "role": "user", "content": "Show me the files in the current directory" }] }'
```

## How does HITL work?

### Events

The human-in-the-loop approach used here is based on a simple idea: the workflow pauses and waits for a human response before proceeding to the next step.

To do this, you will need to implement two custom events:

- [HumanInputEvent](https://github.com/run-llama/create-llama/blob/main/packages/server/src/utils/hitl/events.ts): This event is used to request input from the user.
- [HumanResponseEvent](https://github.com/run-llama/create-llama/blob/main/packages/server/src/utils/hitl/events.ts): This event is sent to the workflow to resume execution with input from the user.

In this example, we have implemented these two custom events in [`events.ts`](src/app/events.ts):

- `cliHumanInputEvent` – to request input from the user for CLI command execution.
- `cliHumanResponseEvent` – to resume the workflow with the response from the user.

```typescript
export const cliHumanInputEvent = humanInputEvent<{
  type: "cli_human_input";
  data: { command: string };
  response: typeof cliHumanResponseEvent;
}>();

export const cliHumanResponseEvent = humanResponseEvent<{
  type: "human_response";
  data: { execute: boolean; command: string };
}>();
```

### UI Component

HITL also needs a custom UI component, that is shown when the LlamaIndexServer receives the `cliHumanInputEvent`. The name of the component is defined in the `type` field of the `cliHumanInputEvent` - in our case, it is `cli_human_input`, which corresponds to the [cli_human_input.tsx](./components/cli_human_input.tsx) component.

The custom component must use `append` to send a message with a `human_response` annotation. The data of the annotation must be in the format of the response event `cliHumanResponseEvent`, in our case, for sending to execute the command `ls -l`, we would send:

```tsx
append({
  content: "Yes",
  role: "user",
  annotations: [
    {
      type: "human_response",
      data: {
        execute: true,
        command: "ls -l", // The command to execute
      },
    },
  ],
});
```

This component displays the command to execute and the user can choose to execute or cancel the command execution.

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex.
- [Workflows Introduction](https://docs.llamaindex.ai/en/stable/understanding/workflows/) - learn about LlamaIndex workflows.
- [LlamaIndex Server](https://pypi.org/project/llama-index-server/)

You can check out [the LlamaIndex GitHub repository](https://github.com/run-llama/llama_index) - your feedback and contributions are welcome!

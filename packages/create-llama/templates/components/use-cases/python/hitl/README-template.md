# LlamaIndex Workflow Example

This is a [LlamaIndex](https://www.llamaindex.ai/) project that using [Workflows](https://docs.llamaindex.ai/en/stable/understanding/workflows/) deployed with [LlamaDeploy](https://github.com/run-llama/llama_deploy).

LlamaDeploy is a system for deploying and managing LlamaIndex workflows, while LlamaIndexServer provides a pre-built TypeScript server with an integrated chat UI that can connect directly to LlamaDeploy deployments. This example shows how you can quickly set up a complete chat application by combining these two technologies/

## Prerequisites

If you haven't installed uv, you can follow the instructions [here](https://docs.astral.sh/uv/getting-started/installation/) to install it.

You can configure [LLM model](https://docs.llamaindex.ai/en/stable/module_guides/models/llms) and [embedding model](https://docs.llamaindex.ai/en/stable/module_guides/models/embeddings) in [src/settings.py](src/settings.py).

Please setup their API keys in the `src/.env` file.

## Installation

Both the SDK and the CLI are part of the LlamaDeploy Python package. To install, just run:

```bash
uv sync
```

If you don't have uv installed, you can follow the instructions [here](https://docs.astral.sh/uv/getting-started/installation/).

## Running the Deployment

At this point we have all we need to run this deployment. Ideally, we would have the API server already running
somewhere in the cloud, but to get started let's start an instance locally. Run the following python script
from a shell:

```
$ uv run -m llama_deploy.apiserver
INFO:     Started server process [10842]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:4501 (Press CTRL+C to quit)
```

From another shell, use the CLI, `llamactl`, to create the deployment:

```
$ uv run llamactl deploy llama_deploy.yml
Deployment successful: chat
```

## UI Interface

LlamaDeploy will serve the UI through the apiserver. Point the browser to [http://localhost:4501/deployments/chat/ui](http://localhost:4501/deployments/chat/ui) to interact with your deployment through a user-friendly interface.

## API endpoints

You can find all the endpoints in the [API documentation](http://localhost:4501/docs). To get started, you can try the following endpoints:

Create a new task:

```bash
curl -X POST 'http://localhost:4501/deployments/chat/tasks/create' \
  -H 'Content-Type: application/json' \
  -d '{
    "input": "{\"user_msg\":\"Hello\",\"chat_history\":[]}",
    "service_id": "workflow"
  }'
```

Stream events:

```bash
curl 'http://localhost:4501/deployments/chat/tasks/0b411be6-005d-43f0-9b6b-6a0017f08002/events?session_id=dd36442c-45ca-4eaa-8d75-b4e6dad1a83e&raw_event=true' \
  -H 'Content-Type: application/json'
```

Note that the task_id and session_id are returned when creating a new task.

## Use Case

This example shows how to use the LlamaIndexServer with a human in the loop. It allows you to start CLI commands that are reviewed by a human before execution.

To update the workflow, you can modify the code in [`src/workflow.py`](src/workflow.py).

## How does HITL work?

### Events

The human-in-the-loop approach used here is based on a simple idea: the workflow pauses and waits for a human response before proceeding to the next step.

To do this, you will need to implement two custom events:

- [HumanInputEvent](src/events.py): This event is used to request input from the user.
- [HumanResponseEvent](src/events.py): This event is sent to the workflow to resume execution with input from the user.

In this example, we have implemented these two custom events in [`events.py`](src/events.py):

- `cliHumanInputEvent` – to request input from the user for CLI command execution.
- `cliHumanResponseEvent` – to resume the workflow with the response from the user.

### UI Component

HITL also needs a custom UI component, that is shown when the LlamaIndexServer receives the `cliHumanInputEvent`. The name of the component is defined in the `type` field of the `cliHumanInputEvent` - in our case, it is `cli_human_input`, which corresponds to the [cli_human_input.tsx](./ui/components/cli_human_input.tsx) component.

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

## Customize the UI

The UI is served by LLamaIndexServer package, you can configure the UI by modifying the `uiConfig` in the [ui/index.ts](ui/index.ts) file.

The following are the available options:

- `starterQuestions`: Predefined questions for chat interface
- `componentsDir`: Directory for custom event components
- `layoutDir`: Directory for custom layout components
- `llamaCloudIndexSelector`: Enable LlamaCloud integration
- `llamaDeploy`: The LlamaDeploy configration (deployment name and workflow name that defined in the [llama_deploy.yml](llama_deploy.yml) file)

To customize the UI, you can start by modifying the [./ui/components/ui_event.jsx](./ui/components/ui_event.jsx) file.

You can also generate a new code for the workflow using LLM by running the following command:

```
uv run generate_ui
```

## Learn More

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex.
- [Workflows Introduction](https://docs.llamaindex.ai/en/stable/understanding/workflows/) - learn about LlamaIndex workflows.
- [LlamaDeploy GitHub Repository](https://github.com/run-llama/llama_deploy)
- [Chat-UI Documentation](https://ts.llamaindex.ai/docs/chat-ui)

You can check out [the LlamaIndex GitHub repository](https://github.com/run-llama/llama_index) - your feedback and contributions are welcome!
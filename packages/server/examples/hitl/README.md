# Human in the Loop

This example shows how to use the LlamaIndexServer with a human in the loop. It allows you to start CLI commands that are reviewed by a human before execution.

## Getting Started

### Environment Setup

Export your OpenAI API key:

```bash
export OPENAI_API_KEY=<your-openai-api-key>
```

### Starting the Server

Run the server in development mode:

```bash
npx nodemon --exec tsx index.ts --ignore output/*
```

### Access the Application

Open your browser and go to:

```
http://localhost:3000
```

You will see the LlamaIndexServer UI, where you can interact with the HITL agent. Try "List all files in the current directory" and see how the agent pauses and waits for a human response before executing the command.

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

### Workflow Implementation

The workflow is implemented in [`workflow.ts`](src/app/workflow.ts) using LlamaIndex workflows. The workflow handles three main steps:

1. **Initial Request Handling**: When a user input is received, the workflow uses `chatWithTools` to determine if a CLI command should be executed. If so, it emits a `cliHumanInputEvent` to request user permission.

```typescript
workflow.handle([startAgentEvent], async ({ data }) => {
  const { userInput, chatHistory = [] } = data;

  const toolCallResponse = await chatWithTools(
    llm,
    [cliExecutor],
    chatHistory.concat({ role: "user", content: userInput }),
  );

  const cliExecutorToolCall = toolCallResponse.toolCalls.find(
    (toolCall) => toolCall.name === cliExecutor.metadata.name,
  );

  const command = cliExecutorToolCall?.input?.command as string;
  if (command) {
    return cliHumanInputEvent.with({
      type: "cli_human_input",
      data: { command },
      response: cliHumanResponseEvent,
    });
  }

  return summaryEvent.with("");
});
```

2. **Human Response Handling**: After receiving human input, the workflow either executes the command or cancels based on the user's choice.

```typescript
workflow.handle([cliHumanResponseEvent], async ({ data }) => {
  const { command, execute } = data.data;

  if (!execute) {
    return summaryEvent.with(`User reject to execute the command ${command}`);
  }

  const result = (await cliExecutor.call({ command })) as string;

  return summaryEvent.with(
    `Executed the command ${command} and got the result: ${result}`,
  );
});
```

3. **Final Response**: The workflow generates a final response based on the execution result and streams it back to the user.

### Tools

The CLI executor tool is defined in [`tools.ts`](src/app/tools.ts):

```typescript
export const cliExecutor = tool({
  name: "cli_executor",
  description: "This tool executes a command and returns the output.",
  parameters: z.object({ command: z.string() }),
  execute: async ({ command }) => {
    try {
      const output = execSync(command, {
        encoding: "utf-8",
      });
      return output;
    } catch (error) {
      console.error(error);
      return "Command failed";
    }
  },
});
```

## Architecture

The HITL implementation consists of:

1. **Workflow Factory** (`workflow.ts`): Creates and configures the workflow with event handlers
2. **Events** (`events.ts`): Defines typed events for human input and response
3. **Tools** (`tools.ts`): Implements the CLI executor tool
4. **UI Component** (`components/cli_human_input.tsx`): Provides the user interface for human approval
5. **Server Entry** (`index.ts`): Configures and starts the LlamaIndexServer

This architecture ensures that dangerous operations like CLI command execution require explicit human approval before proceeding.

# Human in the Loop

This example shows how to use the LlamaIndexServer with a human in the loop. It allows you to start CLI commands that are reviewed by a human before execution.

## Getting Started

### AgentWorkflow

Using AgentWorkflow, you need to run the following command:

```bash
uv run -- agent_workflow.py
```

### Custom Workflow

```bash
uv run -- custom_workflow.py
```

### Access the Application

Open your browser and go to:

```
http://localhost:8000
```

You will see the LlamaIndexServer UI, where you can interact with the HITL agent. Try "List all files in the current directory" and see how the agent pauses and waits for a human response before executing the command.

## How does HITL it work?

### Events

The human-in-the-loop approach used here is based on a simple idea: the workflow pauses and waits for a human response before proceeding to the next step.

To do this, you will need to implement two custom events: 
+ [HumanInputEvent](../../llama_index/server/models/hitl.py#L21): This event is used to request input from the user.
+ [HumanResponseEvent](../../llama_index/server/models/hitl.py#L10): This event is sent to the workflow to resume execution with input from the user.

In this example, we have implemented these two custom events:  

- [CLIHumanInputEvent](events.py#L20) – to request input from the user for CLI command execution.
- [CLIHumanResponseEvent](events.py#L8) – to resume the workflow with the response from the user.

### UI Component

HITL also needs a custom UI component, that is shown when the LlamaIndexServer receives the `CLIHumanInputEvent`. The name of the component is defined in the `event_type` field of the `CLIHumanInputEvent` - in our case, it is `cli_human_input`, which corresponds to the [cli_human_input.tsx](./components/cli_human_input.tsx) component.

The custom component must use `append` to send a message with a `human_response` annotation. The data of the annotation must be in the format of the response event `CLIHumanResponseEvent`, in our case, for sending to execute the command `ls -l`, we would send:

```tsx
append({
    content: "Yes",
    role: "user",
    annotations: [
    {
        type: "human_response",
        data: {
            execute: true,
            command: "ls -l" // The command to execute
        },
    },
    ],
});
```

This component displays the command to execute and the user can choose to execute or cancel the command execution.

### AgentWorkflow

To make the [AgentWorkflow](agent_workflow.py) work, we use the `wait_for_event()` method to wait for the human response when a tool is called.

Example:
```python
async def cli_executor(ctx: Context, command: str) -> str:
    """
    This tool carefully waits for user confirmation before executing a command.
    """
    confirmation = await ctx.wait_for_event(
        CLIHumanResponseEvent,
        waiter_event=CLIHumanInputEvent(
            data=CLICommand(command=command),
        ),
    )
    if confirmation.execute:
        # Execute the command
        ...
    else:
        # Cancel the command
        ...

```

### LlamaIndex Workflows

And for [Custom Workflow](custom_workflow.py), we can define a step that send the `CLIHumanInputEvent` and another step that wait for the `CLIHumanResponseEvent`.

Example:
```python
@step
async def request_input(self, ctx: Context, ev: StartEvent) -> CLIHumanInputEvent:
    ...
    return CLIHumanInputEvent(
        data=CLICommand(command=command),
        response_event_type=CLIHumanResponseEvent,
    )

@step
async def handle_human_response(self, ctx: Context, ev: CLIHumanResponseEvent) -> StopEvent:
    if ev.execute:
        # Execute the command
        ...
    else:
        # Cancel the command
        ...
```
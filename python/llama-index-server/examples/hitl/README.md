# Human in the Loop

This example shows how to use the LlamaIndexServer with a human in the loop.

## AgentWorkflow

```bash
uv run -- agent_workflow.py
```

## Custom Workflow

```bash
uv run -- custom_workflow.py
```

## How does it work?
The human-in-the-loop approach used here is based on a simple idea: the workflow pauses and waits for a human response before proceeding to the next step.

To do this, you will need to implement two custom events: 
+ [HumanInputEvent](../../llama_index/server/api/models.py#L225): This event is used to request input from the user.
+ [HumanResponseEvent](../../llama_index/server/api/models.py#L258): This event is sent to the workflow to resume execution with input from the user.

In this example, we have implemented these two custom events:  

- [CLIHumanInputEvent](events.py#L20) – to request input from the user for CLI command execution.
- [CLIHumanResponseEvent](events.py#L8) – to resume the workflow with the response from the user.

We also have a custom component, [cli_human_input.tsx](./components/cli_human_input.tsx), which displays a card that the user can update the command and choose to execute or cancel the command execution.

To make the [AgentWorkflow](agent_workflow.py) work, we use the `wait_for_event()` method to wait for the human response when a tool is called.

Example:
```python
async def cli_executor(ctx: Context, command: str) -> str:
    """
    This tool carefully waits for user confirmation before executing a command.
    """
    # You can use other pattern to generate the waiter_id, 
    # but make sure it'll be same when we resume the workflow and re-execute the tool call.
    waiter_id = hashlib.sha256(f"cli_executor:{command}".encode("utf-8")).hexdigest()

    confirmation = await ctx.wait_for_event(
        CLIHumanResponseEvent,
        waiter_id=waiter_id,
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
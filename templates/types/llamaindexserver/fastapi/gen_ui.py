import argparse
import json
import os
import random
import re
from typing import Any, Dict, List, Optional

from llama_index.core.llms import LLM
from llama_index.core.prompts import PromptTemplate
from llama_index.core.workflow import (
    Context,
    Event,
    StartEvent,
    StopEvent,
    Workflow,
    step,
)
from pydantic import BaseModel
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

CACHE_FILE = "gen_ui_cache.json"


class WriteAggregationEvent(Event):
    """
    Event for aggregating events.
    """

    events: List[Dict[str, Any]]


class WriteUIComponentEvent(Event):
    """
    Event for writing UI component.
    """

    events: List[Dict[str, Any]]
    aggregation_function: Optional[str]


class RefineGeneratedCodeEvent(Event):
    """
    Refine the generated code.
    """

    generated_code: str
    aggregation_function_context: Optional[str]
    events: List[Dict[str, Any]]


class ExtractEventSchemaEvent(Event):
    """
    Extract the event schema from the event.
    """

    events: List[Any]


class AggregatePrediction(BaseModel):
    """
    Prediction for aggregating events or not.
    If need_aggregation is True, the aggregation_function will be provided.
    """

    need_aggregation: bool
    aggregation_function: Optional[str]


class GenUIWorkflow(Workflow):
    """
    Generate UI component for event from workflow.
    """

    code_structure: str = """
        ```jsx
            // The code must have no dependencies/imports
            function Component({ events }) { // Don't change this function name
                // logic for the component: aggregation, state,....
                const aggregateEvents = () => {
                    // code for aggregating events here
                }

                // styles for the component
                const styles = {
                    // styles for the component
                }

                // State for the component
                // e.g: const [state, setState] = React.useState({});
                // handle the state here

                return (
                    <div style={styles.container}>
                        // UI code here
                    </div>
                )
            }
            // Don't need to export the component
        ```
    """

    def __init__(self, llm: LLM, **kwargs: Any):
        super().__init__(**kwargs)
        self.llm = llm
        self.console = Console()
        self._live: Optional[Live] = None
        self._completed_steps: List[str] = []
        self._current_step: Optional[str] = None

    def update_status(self, message: str, completed: bool = False):
        """Show completed and current steps in a panel."""
        if completed:
            if self._current_step:
                self._completed_steps.append(self._current_step)
            self._current_step = None
        else:
            self._current_step = message

        if self._live is None:
            self._live = Live("", console=self.console, refresh_per_second=4)
            self._live.start()

        # Build status display
        status_lines = []
        for completed_step in self._completed_steps:
            status_lines.append(f"[green]✓[/green] {completed_step}")
        if self._current_step:
            status_lines.append(f"[yellow]⋯[/yellow] {self._current_step}")

        self._live.update(Panel("\n".join(status_lines)))

    @step
    async def start(self, ctx: Context, ev: StartEvent) -> WriteAggregationEvent:
        events = ev.events
        if not events:
            raise ValueError(
                "events is required, provide list of filtered events to generate UI components for"
            )
        output_file = ev.output_file
        if not output_file:
            raise ValueError(
                "output_file is required. Provide the path of the file to save the generated UI component"
            )
        await ctx.set("output_file", output_file)
        await ctx.set("events", events)
        self.update_status("Generating aggregation function")
        return WriteAggregationEvent(events=events)

    @step
    async def generate_event_aggregations(
        self, ctx: Context, ev: WriteAggregationEvent
    ) -> WriteUIComponentEvent:
        prompt_template = """
            # Your role
            You are a frontend developer who is developing a React component for given events that are emitted from a backend workflow.
            Here are the events that you need to work on: {events}

            # Task
            Your task is to analyze the use case of the workflow and the event schema, then write aggregation functions if needed for UI rendering.
            Take into account that the list of events grows with time. At the beginning, there is only one event in the list, and events are incrementally added. 
            To render the events in a visually pleasing way, try to aggregate them by their attributes and render the aggregates instead of just rendering a list of all events.
            Don't add computation to the aggregation function, just group the events by their attributes.

            # Answer with the following format:
            ```jsx
            const aggregateEvents = () => {
                // code for aggregating events here if needed otherwise let the jsx code block empty
            }
            ```
            """

        response = await self.llm.acomplete(
            PromptTemplate(prompt_template).format(events=ev.events),
            formatted=True,
        )
        await ctx.set("aggregation_context", response.text)

        self.update_status("Generating aggregation function", completed=True)
        self.update_status("Generating UI components")
        return WriteUIComponentEvent(
            events=ev.events,
            aggregation_function=response.text,
        )

    @step
    async def write_ui_component(
        self, ctx: Context, ev: WriteUIComponentEvent
    ) -> RefineGeneratedCodeEvent:
        prompt_template = """
            # Your role
            You are a frontend developer who is developing a React component for given events that are emitted from a backend.

            # Context:
            Here are the events that you need to work on: {events}
            {aggregation_function_context}

            # Requirements:
            - Write beautiful UI components for the events without additional dependencies/imports.
            - The component text/label should be specified for each event type.
            - If the components are stateful, ensure the state is stored and handled correctly.
            - Ensure the UI components are well-designed and logical.

            # Instructions:
            - Based on the provided list of events, determine their types and attributes.
            - It's normal that the schema is applied to all events, but the events might completely different which some of schema attributes aren't used.
            - You should make the component visually distinct for each event type, don't reuse the same code text label, children, styles, handler logic,... for different event types.
            e.g: A simple cat schema
                ```{"type": "cat", "action": ["jump", "run", "meow"], "jump": {"height": 10, "distance": 20}, "run": {"distance": 100}}```
                You should write three distinct components for the jump, run and meow actions. Don't try to render "height" for the "run" and "meow" action.
        
            - Use HTML with pure CSS to create an aesthetically pleasing UI. 
              For example:
                - Generate code for cards to wrap up the events, with proper styles for borders, rounded corners, padding, margin, etc.
                - Generate code for badges to highlight the state/type, with distinct styles for different states
                - Generate code for dropdowns if the event content might be too long to display in a single line.
                - Use icons or emojis to visualize the state
            - Consider using a grid layout to create a visually appealing UI.

            # Example styles:
                const styles = {
                    container: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' },
                    // Card styles - children can be placed in different positions, e.g.: top-right, top-left, bottom-right, bottom-left, etc.
                    card: { border: '1px solid #ccc', borderRadius: '8px', padding: '16px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' },
                    // Badge styles - can be extended, colors can be changed, etc.
                    badge: { display: 'inline-block', padding: '4px 8px', fontSize: '12px', fontWeight: '600', borderRadius: '9999px' },
                    dropdown: { marginTop: '8px', cursor: 'pointer', color: '#3B82F6' },
                    dropdownContent: { marginTop: '8px', padding: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#F3F4F6' }
                };
            """

        aggregation_function_context = (
            f"\nBefore rendering the events, we're using the following aggregation function: {ev.aggregation_function}"
            if ev.aggregation_function
            else ""
        )

        prompt = PromptTemplate(prompt_template).format(
            events=ev.events,
            aggregation_function_context=aggregation_function_context,
            code_structure=self.code_structure,
        )
        response = await self.llm.acomplete(prompt, formatted=True)

        self.update_status("Generating UI components", completed=True)
        self.update_status("Refining generated code")
        return RefineGeneratedCodeEvent(
            generated_code=response.text,
            events=ev.events,
            aggregation_function_context=aggregation_function_context,
        )

    @step
    async def refine_code(
        self, ctx: Context, ev: RefineGeneratedCodeEvent
    ) -> StopEvent:
        prompt_template = """
            # Your role
            You are a frontend developer who is developing a React component for given events that are emitted from a backend workflow.
            Your task is to assemble the pieces of code into a complete code segment that follows the specified code structure.

            # Context:
            ## Here is the generated code:
            {generated_code}

            {aggregation_function_context}

            ## The generated code should follow the following structure:
            {code_structure}

            # Requirements:
            - Refine the code to ensure there are no potential bugs.
            - Don't be verbose, only return the code, wrap it in ```jsx <code>```
        """
        prompt = PromptTemplate(prompt_template).format(
            generated_code=ev.generated_code,
            code_structure=self.code_structure,
            aggregation_function_context=ev.aggregation_function_context,
        )

        response = await self.llm.acomplete(prompt, formatted=True)

        # Extract code from response, handling case where code block is missing
        code_match = re.search(r"```jsx(.*)```", response.text, re.DOTALL)
        if code_match is None:
            # If no code block found, use full response
            code = response.text
        else:
            code = code_match.group(1).strip()

        # Write the generated code to the output file
        output_file = await ctx.get("output_file")
        with open(output_file, "w") as f:
            f.write(code)

        self.update_status("Refining generated code", completed=True)
        if self._live is not None:
            self._live.stop()
            self._live = None

        return StopEvent(
            result=code,
        )


def get_cache_key(workflow_input: str, expected_events: List[str]) -> str:
    """Generate a unique cache key for the workflow input and expected events."""
    sorted_events = ",".join(sorted(expected_events))
    return f"{workflow_input}::{sorted_events}"


async def execute_workflow(workflow_input: str) -> List[Any]:
    """
    Execute the workflow and collect all events.
    Returns the raw workflow events.
    """
    from app.workflow import create_workflow

    console = Console()
    console.print(
        Panel(
            f"[bold cyan]Workflow Input:[/bold cyan] [yellow]{workflow_input}[/yellow]",
            title="🚀 Starting Workflow",
            border_style="cyan",
        )
    )

    workflow = create_workflow()

    # Show progress while running workflow
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("[cyan]Running workflow...", total=None)

        handler = workflow.run(user_msg=workflow_input)
        workflow_events = []
        async for event in handler.stream_events():
            workflow_events.append(event)
            progress.update(
                task, description=f"[cyan]Collected {len(workflow_events)} events..."
            )

        await handler
        progress.update(task, description="[green]Workflow completed!")

    return workflow_events


def filter_events(
    workflow_events: List[Any], expected_events: List[str]
) -> List[Dict[str, Any]]:
    """
    Filter and process workflow events based on expected event types.
    Returns a list containing both event schemas and sample events.
    """
    console = Console()

    # Collect events by type
    events_by_type: Dict[str, List[Any]] = {}
    for event in workflow_events:
        if type(event).__name__ in expected_events:
            event_type = type(event).__name__
            if event_type not in events_by_type:
                events_by_type[event_type] = []
            events_by_type[event_type].append(event)
        elif hasattr(event, "data"):
            if event.data.__class__.__name__ in expected_events:
                event_type = event.data.__class__.__name__
                if event_type not in events_by_type:
                    events_by_type[event_type] = []
                events_by_type[event_type].append(event.data)

    if not events_by_type:
        console.print(
            Panel(
                f"[red]No events of types {expected_events} found in the workflow events[/red]",
                title="❌ Error",
                border_style="red",
            )
        )
        raise ValueError(
            f"No events of types {expected_events} found in the workflow events"
        )

    result_events = []

    # Add both schema and sample events to the list
    for event_type, events in events_by_type.items():
        # Add schema as an event
        result_events.append(json.loads(events[0].schema_json()))

        # Add some sample for the event
        num_samples = min(5, len(events))
        samples = random.sample(events, num_samples)
        for sample in samples:
            result_events.append(sample.model_dump())

    return result_events


async def execute_workflow_and_filter_events(
    workflow_input: str, expected_events: List[str], force_refresh: bool = False
) -> List[Dict[str, Any]]:
    """
    Execute the workflow and filter events based on expected event types.
    Returns a list containing both event schemas and sample events.

    Args:
        workflow_input: The input for the workflow
        expected_events: List of event types to filter for
        force_refresh: If True, ignores cached results and forces a new workflow execution
    """
    console = Console()

    # Check cache file if not forcing refresh
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                cached_events = json.load(f)
                console.print(
                    Panel(
                        "[bold cyan]Using cached results[/bold cyan] for this workflow input. \nTo force a fresh execution, use the [bold yellow]--force-refresh[/bold yellow] flag.",
                        title="🚀 Cache Hit",
                        border_style="cyan",
                    )
                )
                return cached_events
        except json.JSONDecodeError:
            # If cache file is corrupted, ignore it
            pass

    # Execute workflow and filter events
    workflow_events = await execute_workflow(workflow_input)
    result_events = filter_events(workflow_events, expected_events)

    # Cache the results
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(result_events, f, indent=2)
    except Exception as e:
        console.print(f"[yellow]Warning:[/yellow] Failed to cache results: {e}")

    return result_events


async def main(
    workflow_input: str,
    events: List[str],
    output_file: str,
    force_refresh: bool = False,
):
    from llama_index.llms.anthropic import Anthropic

    MODEL = "claude-3-7-sonnet-latest"

    console = Console()

    # Execute workflow and get filtered events with schema
    console.rule("[bold blue]Step 1: Execute Workflow[/bold blue]")
    filtered_events = await execute_workflow_and_filter_events(
        workflow_input=workflow_input,
        expected_events=events,
        force_refresh=force_refresh,
    )

    # Generate UI components
    console.rule("[bold blue]Step 2: Generate UI Components[/bold blue]")
    llm = Anthropic(model=MODEL, max_tokens=8192)
    workflow = GenUIWorkflow(llm=llm, timeout=500.0)
    await workflow.run(events=filtered_events, output_file=output_file)

    console.print(
        Panel(
            f"[green]UI component has been generated successfully![/green]\nOutput file: [bold cyan]{output_file}[/bold cyan]",
            title="✨ Complete",
            border_style="green",
        )
    )


def pre_run_checks():
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise ValueError(
            "Anthropic API key is not set. Please set the ANTHROPIC_API_KEY environment variable."
        )
    try:
        from llama_index.llms.anthropic import Anthropic  # noqa: F401
    except ImportError:
        raise ValueError(
            "Anthropic package is not installed. Please install it with `poetry add llama-index-llms-anthropic` or `pip install llama-index-llms-anthropic`."
        )


if __name__ == "__main__":
    import asyncio

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--workflow_input", type=str, required=True, help="The input for the workflow"
    )
    parser.add_argument(
        "--events",
        type=str,
        required=True,
        help="Comma-separated list of model names of the events",
    )
    parser.add_argument(
        "--output_file", type=str, required=True, help="Path to the output file"
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Force fresh workflow execution, ignoring cached results",
    )
    args = parser.parse_args()

    pre_run_checks()

    # Convert events string to list
    events = [event.strip() for event in args.events.split(",") if event.strip()]

    asyncio.run(
        main(
            workflow_input=args.workflow_input,
            events=events,
            output_file=args.output_file,
            force_refresh=args.force_refresh,
        )
    )

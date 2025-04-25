import re
from typing import Any, Dict, List, Optional, Type

from pydantic import BaseModel
from rich.console import Console
from rich.live import Live
from rich.panel import Panel

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
from llama_index.server.gen_ui.parse_workflow_code import get_workflow_event_schemas


class PlanningEvent(Event):
    """
    Event for planning the UI.
    """

    events: List[Dict[str, Any]]


class WriteAggregationEvent(Event):
    """
    Event for aggregating events.
    """

    events: List[Dict[str, Any]]
    ui_description: str


class WriteUIComponentEvent(Event):
    """
    Event for writing UI component.
    """

    events: List[Dict[str, Any]]
    aggregation_function: Optional[str]
    ui_description: str


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
            // Note: Only React, shadcn/ui, lucide-react, LlamaIndex's markdown-ui and tailwind css (cn) are allowed.

            // export the component
            export default function Component({ events }) {
                // logic for aggregating events (if needed)
                const aggregateEvents = () => {
                    // code for aggregating events here
                }
            
                // State handling
                // e.g: const [state, setState] = useState({});

                return (
                    // UI code here
                )
            }
        ```
    """

    supported_deps = """
        - React: import { useState } from "react";
        - shadcn/ui: import { ComponentName } from "@/components/ui/<component_path>";
            Supported shadcn components:  
                accordion, alert, alert-dialog, aspect-ratio, avatar, badge, 
                breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, 
                context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, 
                menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, 
                scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, 
                tabs, textarea, toggle, toggle-group, tooltip  
        - lucide-react: import { IconName } from "lucide-react";
        - tailwind css: import { cn } from "@/lib/utils"; // Note: clsx is not supported
        - LlamaIndex's markdown-ui: import { Markdown } from "@llamaindex/chat-ui/widgets";
    """

    def __init__(self, llm: LLM, **kwargs: Any):
        super().__init__(**kwargs)
        self.llm = llm
        self.console = Console()
        self._live: Optional[Live] = None
        self._completed_steps: List[str] = []
        self._current_step: Optional[str] = None

    def update_status(self, message: str, completed: bool = False) -> None:
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
    async def start(self, ctx: Context, ev: StartEvent) -> PlanningEvent:
        events = ev.events
        if not events:
            raise ValueError(
                "events is required, provide list of filtered events to generate UI components for"
            )
        await ctx.set("events", events)
        self.update_status("Planning the UI")
        return PlanningEvent(events=events)

    @step
    async def planning(self, ctx: Context, ev: PlanningEvent) -> WriteAggregationEvent:
        prompt_template = """
            # Your role
            You are a designer who is designing a UI for given events that are emitted from a backend workflow.
            Here are the events that you need to work on: {events}

            # Task
            Your task is to analyze the event schema and data and provide a description that how the UI would look like.
            The UI should be beautiful, no monotonous, and visually pleasing.
            Focus on the elements and the layout, don't ask too much on the styles (transition, dark mode, responsive, etc...).

            e.g: Assume that the backend produce list of events with animal name, action, and status.
            ```
            A card-based layout displaying animal actions:
            - Each card shows an animal's image at the top
            - Below the image: animal name as the card title
            - Action details in the card body with an icon (eating 🍖, sleeping 😴, playing 🎾)
            - Status badge in the corner showing if action is ongoing/completed
            - Expandable section for additional details
            - Soft color scheme based on action type
            ```
            Don't be verbose, just return the description for the UI based on the event schema and data.
        """
        response = await self.llm.acomplete(
            PromptTemplate(prompt_template).format(events=ev.events),
            formatted=True,
        )
        await ctx.set("ui_description", response.text)
        self.update_status("Planning the UI", completed=True)
        # Update the planning description to the console
        self.console.print(
            Panel(
                response.text,
                title="UI Description",
                border_style="cyan",
            )
        )
        self.update_status("Generating aggregation function")
        return WriteAggregationEvent(
            events=ev.events,
            ui_description=response.text,
        )

    @step
    async def generate_event_aggregations(
        self, ctx: Context, ev: WriteAggregationEvent
    ) -> WriteUIComponentEvent:
        prompt_template = """
            # Your role
            You are a frontend developer who is developing a React component for given events that are emitted from a backend workflow.
            Here are the events that you need to work on: {events}
            Here is the description of the UI:
            ```
                {ui_description}
            ```

            # Task
            Based on the description of the UI and the list of events, write the aggregation function that will be used to aggregate the events.
            Take into account that the list of events grows with time. At the beginning, there is only one event in the list, and events are incrementally added. 
            To render the events in a visually pleasing way, try to aggregate them by their attributes and render the aggregates instead of just rendering a list of all events.
            Don't add computation to the aggregation function, just group the events by their attributes.
            Make sure that the aggregation should reflect the description of the UI and the grouped events are not duplicated, make it as simple as possible to avoid unnecessary issues.

            # Answer with the following format:
            ```jsx
            const aggregateEvents = () => {
                // code for aggregating events here if needed otherwise let the jsx code block empty
            }
            ```
            """

        response = await self.llm.acomplete(
            PromptTemplate(prompt_template).format(
                events=ev.events,
                ui_description=ev.ui_description,
            ),
            formatted=True,
        )
        await ctx.set("aggregation_context", response.text)

        self.update_status("Generating aggregation function", completed=True)
        self.update_status("Generating UI components")
        return WriteUIComponentEvent(
            events=ev.events,
            aggregation_function=response.text,
            ui_description=ev.ui_description,
        )

    @step
    async def write_ui_component(
        self, ctx: Context, ev: WriteUIComponentEvent
    ) -> RefineGeneratedCodeEvent:
        prompt_template = """
            # Your role
            You are a frontend developer who is developing a React component using shadcn/ui, lucide-react, LlamaIndex's chat-ui, and tailwind css (cn) for the UI.
            You are given a list of events and other context.
            Your task is to write a beautiful UI for the events that will be included in a chat UI.

            # Context:
            Here are the events that you need to work on: {events}
            {aggregation_function_context}
            Here is the description of the UI:
            ```
                {ui_description}
            ```

            # Supported dependencies:
            {supported_deps}

            # Requirements:
            - Write beautiful UI components for the events using the supported dependencies
            - The component text/label should be specified for each event type.

            # Instructions:
            ## Event and schema notice
            - Based on the provided list of events, determine their types and attributes.
            - It's normal that the schema is applied to all events, but the events might completely different which some of schema attributes aren't used.
            - You should make the component visually distinct for each event type.
              e.g: A simple cat schema
                ```{"type": "cat", "action": ["jump", "run", "meow"], "jump": {"height": 10, "distance": 20}, "run": {"distance": 100}}```
                You should display the jump, run and meow actions in different ways. don't try to render "height" for the "run" and "meow" action.

            ## UI notice
            - Use the supported dependencies for the UI.
            - Be careful on state handling, make sure the update should be updated in the state and there is no duplicate state.
            - For a long content, consider to use markdown along with dropdown to show the full content.
                e.g:
                ```jsx
                import { Markdown } from "@llamaindex/chat-ui/widgets";
                <Markdown content={content} />
                ```
            - Try to make the component placement not monotonous, consider use row/column/flex/grid layout.
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
            ui_description=ev.ui_description,
            supported_deps=self.supported_deps,
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
            - Only use supported dependencies: {supported_deps}
            - Refine the code if needed to ensure there are no potential bugs. 
            - Be careful on code placement, make sure it doesn't call any undefined code.
            - Make sure the import statements are correct. 
              e.g: import { Button, Card, Accordion } from "@/components/ui" is correct because Button, Card are defined in different shadcn/ui components.
              -> correction: import { Button } from "@/components/ui/button";
                             import { Card } from "@/components/ui/card";
            - Don't be verbose, only return the code, wrap it in ```jsx <code>```
        """
        prompt = PromptTemplate(prompt_template).format(
            generated_code=ev.generated_code,
            code_structure=self.code_structure,
            aggregation_function_context=ev.aggregation_function_context,
            supported_deps=self.supported_deps,
        )

        response = await self.llm.acomplete(prompt, formatted=True)

        # Extract code from response, handling case where code block is missing
        code_match = re.search(r"```jsx(.*)```", response.text, re.DOTALL)
        if code_match is None:
            # If no code block found, use full response
            code = response.text
        else:
            code = code_match.group(1).strip()

        self.update_status("Refining generated code", completed=True)
        if self._live is not None:
            self._live.stop()
            self._live = None

        return StopEvent(
            result=code,
        )


async def generate_event_component(
    workflow_file: Optional[str] = None,
    event_cls: Optional[Type[BaseModel]] = None,
    llm: Optional[LLM] = None,
) -> str:
    """
    Generate UI component for events from workflow.
    Either workflow_file or event_cls must be provided.

    Args:
        workflow_file: The path to the workflow file that contains the event to generate UI for. e.g: `app/workflow.py`.
        event_cls: A Pydantic class to generate UI for. e.g: `DeepResearchEvent`.
        llm: The LLM to use for the generation. Default is Anthropic's Claude 3.7 Sonnet.
             We recommend using these LLMs:
                - Anthropic's Claude 3.7 Sonnet
                - OpenAI's GPT-4.1
                - Google Gemini 2.5 Pro
    Returns:
        The generated UI component code.
    """
    if workflow_file is None and event_cls is None:
        raise ValueError(
            "Either workflow_file or event_cls must be provided. Please provide one of them."
        )
    if workflow_file is not None and event_cls is not None:
        raise ValueError(
            "Only one of workflow_file or event_cls can be provided. Please provide only one of them."
        )
    if llm is None:
        from llama_index.llms.anthropic import Anthropic

        llm = Anthropic(model="claude-3-7-sonnet-latest", max_tokens=8192)

    console = Console()

    # Get event schemas
    if workflow_file is not None:
        # Get event schemas from the input file
        console.rule("[bold blue]Analyzing Events[/bold blue]")
        event_schemas = get_workflow_event_schemas(workflow_file)
        if len(event_schemas) == 0:
            console.print(
                Panel(
                    "[red]No events found that are used with write_event_to_stream[/red]",
                    title="❌ Error",
                    border_style="red",
                )
            )
            raise RuntimeError(
                "No events found that are used with write_event_to_stream. Please check the workflow file."
            )
    elif event_cls is not None:
        event_schemas = [
            {"type": event_cls.__name__, "schema": event_cls.model_json_schema()}
        ]

    # Generate UI component from event schemas
    console.rule("[bold blue]Generate UI Components[/bold blue]")

    workflow = GenUIWorkflow(llm=llm, timeout=500.0)
    code = await workflow.run(events=event_schemas)

    console.print(
        Panel(
            "[green]UI component has been generated successfully![/green]\n",
            title="✨ Complete",
            border_style="green",
        )
    )

    return code

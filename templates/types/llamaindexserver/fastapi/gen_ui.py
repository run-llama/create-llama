import argparse
import re
from typing import Any, List, Optional

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
from pydantic import BaseModel, Field


class RunWorkflowEvent(Event):
    """
    Event for running the workflow.
    """

    workflow_input: str = Field(
        description="The input for the workflow. Should be a string like a question"
    )
    events: List[Any] = Field(
        description="The events type that are being used to generate the UI components"
    )


class WriteAggregationEvent(Event):
    """
    Event for aggregating events.
    """

    events: List[Any]


class WriteUIComponentEvent(Event):
    """
    Event for writing UI component.
    """

    events: List[Any]
    aggregation_function: Optional[str]


class RefineGeneratedCodeEvent(Event):
    """
    Refine the generated code.
    """

    generated_code: str
    aggregation_function_context: Optional[str]
    events: List[Any]


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


class EventSchema(BaseModel):
    """
    Schema for the event.
    """

    schema: str = Field(description="The json schema inferred from the pydantic model")
    example: List[Any] = Field(
        description="Example of the event in a list of json values"
    )


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

    @step
    async def start(self, ctx: Context, ev: StartEvent) -> RunWorkflowEvent:
        workflow_input = ev.workflow_input
        if not workflow_input:
            raise ValueError("workflow_input is required")
        events = ev.events
        if not events:
            raise ValueError(
                "events is required, provide list of events that are emitted from the workflow that you want to generate the UI components for"
            )
        output_file = ev.output_file
        if not output_file:
            raise ValueError(
                "output_file is required. Provide the path of the file to save the generated UI component"
            )
        await ctx.set("output_file", output_file)
        return RunWorkflowEvent(
            workflow_input=workflow_input,
            events=events,
        )

    @step
    async def run_workflow(
        self, ctx: Context, ev: RunWorkflowEvent
    ) -> WriteAggregationEvent:
        """
        Run the workflow to get the events.
        """
        from app.workflow import create_workflow

        workflow = create_workflow()
        print(
            f"Running workflow with input: {ev.workflow_input}\n Waiting for the workflow to finish..."
        )
        handler = workflow.run(user_msg=ev.workflow_input)

        workflow_events = []
        async for event in handler.stream_events():
            workflow_events.append(event)
        await handler
        print("Workflow finished")
        selected_events = []
        expected_event_names = [
            event if isinstance(event, str) else event.__name__ for event in ev.events
        ]
        for event in workflow_events:
            if type(event).__name__ in expected_event_names:
                selected_events.append(event)
            elif hasattr(event, "data"):
                if event.data.__class__.__name__ in expected_event_names:
                    selected_events.append(event.data)
        if len(selected_events) == 0:
            raise ValueError(f"No event {ev.events} found in the workflow events")
        await ctx.set("events", selected_events)
        return WriteAggregationEvent(
            events=[event.model_dump() for event in selected_events],
        )

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
            Note: 
                - Events might be grouped by some attributes. e.g.: events with the same type and same ID should be grouped together.
                - For aggregation, we just group/update the events by some attributes, no computation is needed.
            """

        response = await self.llm.astructured_predict(
            AggregatePrediction,
            PromptTemplate(prompt_template),
            events=ev.events,
        )
        if response.need_aggregation:
            await ctx.set("aggregation_context", response.aggregation_function)

        return WriteUIComponentEvent(
            events=ev.events,
            aggregation_function=response.aggregation_function,
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
            - Events are given as a list which grows with time. At the beginning, there is only one event in the list, and events are incrementally added.      
            {aggregation_function_context}

            # Requirements:
            - Write beautiful UI components for the events without additional dependencies/imports.
            - The component text/label should be specified for each event type.
            - If the components are stateful, ensure the state is stored and handled correctly.
            - Ensure the UI components are well-designed and logical.

            # Instructions:
            - Based on the provided list of events, determine their types and attributes.
            - For each type of event, design an aesthetically pleasing UI component. 
              To make the component visually distinct, you can:
                + Just use different code for each event type, don't need to reuse the same code for different event types.
                + Generate different children elements, styles, text label, handler logic,... for each event type.
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
            - Refine the code to ensure there are no potential bugs
            - Don't be verbose, only return the code
        """
        prompt = PromptTemplate(prompt_template).format(
            generated_code=ev.generated_code,
            code_structure=self.code_structure,
            events=ev.events,
            aggregation_function_context=ev.aggregation_function_context,
        )

        response = await self.llm.acomplete(prompt, formatted=True)

        # Grep the code inside ```jsx``` wrapper
        code = re.search(r"```jsx(.*)```", response.text, re.DOTALL).group(1)

        # Write the generated code to the output file
        with open(await ctx.get("output_file"), "w") as f:
            f.write(code)

        return StopEvent(
            result=code,
        )


async def main(
    workflow_input: str,
    events: str,
    output_file: str,
):
    from llama_index.llms.openai import OpenAI

    llm = OpenAI(model="gpt-4o")
    workflow = GenUIWorkflow(llm=llm, verbose=True, timeout=500.0)
    await workflow.run(
        workflow_input=workflow_input, events=events, output_file=output_file
    )


if __name__ == "__main__":
    import asyncio

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--workflow_input",
        type=str,
        required=True,
        help="A input message to run the workflow",
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
    args = parser.parse_args()

    # Convert events string to list
    events = [event.strip() for event in args.events.split(",") if event.strip()]

    asyncio.run(
        main(
            workflow_input=args.workflow_input,
            events=events,
            output_file=args.output_file,
        )
    )

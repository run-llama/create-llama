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


class WriteAggregationEvent(Event):
    """
    Event for aggregating events.
    """

    workflow_code: str
    event: str


class WriteUIComponentEvent(Event):
    """
    Event for writing UI component.
    """

    workflow_code: str
    event: str
    aggregation_function: Optional[str]


class RefineGeneratedCodeEvent(Event):
    """
    Refine the generated code.
    """

    generated_code: str
    event: str


class AggregatePrediction(BaseModel):
    """
    Prediction for aggregating events or not.
    If need_aggregation is True, the aggregation_function will be provided.
    """

    need_aggregation: bool
    aggregation_function: Optional[str]


class ExtractEventSchemaEvent(Event):
    """
    Extract the event schema from the event.
    """

    workflow_code: str
    event: str


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

                return (
                    <div style={styles.container}>
                        // UI code here
                    </div>
                )
            }
            // Don't need to export the component
        ```
    """

    def __init__(
        self,
        llm: LLM,
        verbose: bool = False,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.llm = llm
        self.verbose = verbose

    @step
    async def start(self, ctx: Context, ev: StartEvent) -> ExtractEventSchemaEvent:
        workflow_file = ev.workflow_file
        if not workflow_file:
            raise ValueError("workflow_file is required")
        event = ev.event
        if not event:
            raise ValueError(
                "event is required, provide either the pydantic model or the event code/schema"
            )
        output_file = ev.output_file
        if not output_file:
            raise ValueError(
                "output_file is required. Provide the path of the file to save the generated UI component"
            )
        await ctx.set("output_file", output_file)
        # Load workflow code
        with open(workflow_file, "r") as f:
            workflow_code = f.read()

        return ExtractEventSchemaEvent(
            workflow_code=workflow_code,
            event=event,
        )

    @step
    async def identify_event(
        self, ctx: Context, ev: ExtractEventSchemaEvent
    ) -> WriteAggregationEvent:
        prompt_template = """Given a python code:
            {workflow_code}
        
        What is the schema of the event {event} and can you provide some examples for the event?
        """
        response = await self.llm.astructured_predict(
            EventSchema,
            PromptTemplate(prompt_template),
            event=ev.event,
            workflow_code=ev.workflow_code,
        )
        event_context = f"Here is the event schema: {response.schema}\nHere are some examples for the event: {response.example}"
        if self.verbose:
            print(event_context)
        return WriteAggregationEvent(
            workflow_code=ev.workflow_code,
            event=event_context,
        )

    @step
    async def generate_event_aggregations(
        self, ctx: Context, ev: WriteAggregationEvent
    ) -> WriteUIComponentEvent:
        aggregation_context = await ctx.get("aggregation_context", None)
        prompt_template = """
            # Your role
            You are a frontend developer who is developing a React component for given events that are emitted from a backend workflow.
            Your task is to analyze the use case of the workflow and the event schema, then write aggregation functions if needed for UI rendering.
            Take into account that the list of events grows with time. At the beginning, there is only one event in the list, and events are incrementally added. 
            To render the events in a visually pleasing way, try to aggregate them by their attributes and render the aggregates instead of just rendering a list of all events.
            Note: 
                the events might be grouped by some attributes. e.g: event with same type and same id should be grouped together.
                By aggregates, we just group/update the event by some attributes, don't need to do any computation.

            # Context:
            - Here is the workflow code:
            {workflow_code}

            - Here is the event that you need to focus on: {event}
            Note: you don't need to destructure it from event.data; just use all the attributes of the event.

            # Requirements:
            - Analyze the workflow code to understand the use case.
            - Analyze the event to determine if we need to aggregate it or not. 
            - If we need to aggregate the event, write the aggregation function without additional dependencies/imports.
            """
        if aggregation_context:
            prompt_template += f"\n\n# Here is the previous aggregation that might not work: {aggregation_context}"

        response = await self.llm.astructured_predict(
            AggregatePrediction,
            PromptTemplate(prompt_template),
            workflow_code=ev.workflow_code,
            event=ev.event,
        )
        if response.need_aggregation:
            await ctx.set("aggregation_context", response.aggregation_function)

        return WriteUIComponentEvent(
            workflow_code=ev.workflow_code,
            event=ev.event,
            aggregation_function=response.aggregation_function,
        )

    @step
    async def write_ui_component(
        self, ctx: Context, ev: WriteUIComponentEvent
    ) -> RefineGeneratedCodeEvent:
        prompt_template = """
            # Your role
            You are a frontend developer who is developing a React component for given events that are emitted from a backend workflow.
            Your task is to analyze the use case of the workflow and the event schema, along with the aggregation function, to write a beautiful UI component for the event.

            # Context:
            ## Workflow code:
            {workflow_code}

            ## Your code should follow the following structure:
            {code_structure}

            ## Events:
            - Events will be emitted from the backend through the workflow code. The events can be of the same type (updated) or different types.
              The idea is that we need to aggregate events with the same type or same id to avoid re-rendering them in the UI.
            - Take into account that the list of events grows with time. At the beginning, there is only one event in the list, and events are incrementally added. 
              To render the events in a visually pleasing way, try to aggregate them by their attributes and render the aggregates instead of just rendering a list of all events.
            - Here is the event that you need to focus on: {event}
            {aggregation_function_context}

            # Requirements:
            - Write a beautiful UI component for the event without additional dependencies/imports.
            - Follow the provided code structure.
            - Use HTML with Tailwind CSS to generate the UI in a beautiful way. 
              For example:
                - Generate code for cards to wrap up the events, don't forget to add styles for border, rounded corners, padding, margin, etc.
                - Generate code for badges to highlight the state/type, don't forget to add styles for different states
                - Generate code for dropdowns if the event content might be too long to display in a single line.
                  you might need to implement the logic to handle the dropdown state so that the user can expand/collapse the content.
                - Use icons or emojis to visualize the state

            Example styles:
            const styles = {
                container: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' },
                card: { border: '1px solid #ccc', borderRadius: '8px', padding: '16px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' },
                // Badge styles - can extends, change colors, etc.
                badge: { display: 'inline-block', padding: '4px 8px', fontSize: '12px', fontWeight: '600', borderRadius: '9999px' },
                dropdown: { marginTop: '8px', cursor: 'pointer', color: '#3B82F6' },
                dropdownContent: { marginTop: '8px', padding: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#F3F4F6' }
            };
            """

        aggregation_function_context = (
            f"\n\n# Here is the aggregation function: {ev.aggregation_function}"
            if ev.aggregation_function
            else ""
        )

        prompt = PromptTemplate(prompt_template).format(
            workflow_code=ev.workflow_code,
            event=ev.event,
            aggregation_function_context=aggregation_function_context,
            code_structure=self.code_structure,
        )
        response = await self.llm.acomplete(prompt, formatted=True)
        return RefineGeneratedCodeEvent(
            generated_code=response.text,
            event=ev.event,
        )

    @step
    async def refine_code(
        self, ctx: Context, ev: RefineGeneratedCodeEvent
    ) -> StopEvent:
        prompt_template = """
            # Your role
            You are a frontend developer who is developing a React component for given events that are emitted from a backend workflow.
            Your task is to analyze the written code of a UI component and refine it to ensure 
              + There are no potential bugs
              + Make the UI more beautiful, eg: add styles for border, rounded corners, padding, margin, etc.

            # Context:
            ## Here is the generated code:
            {generated_code}

            ## The generated code should follow the following structure:
            {code_structure}

            ## Events:
            - Here is the event that you need to focus on: {event}

            # Requirements:
            - Refine the code to ensure there are no potential bugs.
            - Don't be verbose, only return the code.
        """
        prompt = PromptTemplate(prompt_template).format(
            generated_code=ev.generated_code,
            code_structure=self.code_structure,
            event=ev.event,
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
    workflow_file: str,
    event: str,
    output_file: str,
):
    from llama_index.llms.openai import OpenAI

    llm = OpenAI(model="gpt-4o")
    workflow = GenUIWorkflow(llm=llm, verbose=True, timeout=500.0)
    await workflow.run(
        workflow_file=workflow_file, event=event, output_file=output_file
    )


if __name__ == "__main__":
    import asyncio

    parser = argparse.ArgumentParser()
    parser.add_argument("--workflow_file", type=str, required=True)
    parser.add_argument("--event", type=str, required=True)
    parser.add_argument("--output_file", type=str, required=True)
    args = parser.parse_args()

    asyncio.run(
        main(
            workflow_file=args.workflow_file,
            event=args.event,
            output_file=args.output_file,
        )
    )

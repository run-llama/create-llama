import { createWorkflow, workflowEvent, getContext } from "@llama-flow/core";
import { z } from "zod";
import { until } from "@llama-flow/core/stream/until";
import { collect } from "@llama-flow/core/stream/consumer";
import { LLM } from "llamaindex";
import { zodToJsonSchema } from "zod-to-json-schema";

const planUiEvent = workflowEvent<{
  eventSchema: object;
}>();

const writeAggregationEvent = workflowEvent<{
  eventSchema: object;
  uiDescription: string;
}>();

const writeUiComponentEvent = workflowEvent<{
  eventSchema: object;
  uiDescription: string;
  aggregationFunction: string | undefined;
}>();

const refineGeneratedCodeEvent = workflowEvent<{
  uiCode: string;
  aggregationFunction: string;
  uiDescription: string;
}>();

export const stopEvent = workflowEvent<string | null>();

const CODE_STRUCTURE = `
// Note: Only shadcn/ui and lucide-react and tailwind css are allowed.
// shadcn import pattern: import { ComponentName } from "@/components/ui/<component_path>";
// e.g: import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import cn from "@/lib/utils"; // clsx is not supported

// export the component
// The component accepts an 'events' array prop. Each item in the array conforms to the schema provided during generation.
export default function Component({ events }) {
  // logic for aggregating events (if needed)
  const aggregatedEvents = // ... aggregation logic based on aggregationFunction description ...

  // Determine which events to render (original or aggregated)
  const eventsToRender = aggregatedEvents || events;

  return (
    <div>
      {/* Render eventsToRender using shadcn/ui, lucide-react, tailwind CSS */}
      {/* Map over eventsToRender and display each one */}
      {/* Example: */}
      {/* {eventsToRender.map((event, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle>Event Data</CardTitle> // Adjust title as needed
          </CardHeader>
          <CardContent>
            <pre>{JSON.stringify(event, null, 2)}</pre>
          </CardContent>
        </Card>
      ))} */}
    </div>
  );
}
`;
const SUPPORTED_DEPS = `
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
`;

/**
 * Creates the UI generation workflow with the provided LLM instance.
 *
 * @param llm - The LLM instance to use for the workflow.
 * @returns The configured workflow instance.
 */
export function createGenUiWorkflow(llm: LLM) {
  const genUiWorkflow = createWorkflow();

  genUiWorkflow.handle([planUiEvent], async ({ data: { eventSchema } }) => {
    const context = getContext();

    const planningPrompt = `
# Your role
You are an AI assistant helping to plan a React UI component. This component will display *one or more events* in a chat application, all conforming to a single JSON schema.

# Context
Here is the JSON schema for the events the component needs to display:
${JSON.stringify(eventSchema, null, 2)}

# Task
1. Analyze the event schema.
2. Decide if multiple events of this type should be aggregated before rendering in the UI (e.g., group similar events, summarize sequences). Assume the component will receive an array of these events.
3. If aggregation is needed, provide a *brief* description of the JavaScript function logic (no code implementation yet, just the logic description) that would take an array of events and return an aggregated representation.
4. Provide a concise description of the desired UI look and feel for displaying these events (e.g., "Display each event in a card with an icon representing the event type.").

e.g: Assume that the backend produce list of events with animal name, action, and status.
    \`\`\`
    A card-based layout displaying animal actions:
    - Each card shows an animal's image at the top
    - Below the image: animal name as the card title
    - Action details in the card body with an icon (eating 🍖, sleeping 😴, playing 🎾)
    - Status badge in the corner showing if action is ongoing/completed
    - Expandable section for additional details
    - Soft color scheme based on action type
    \`\`\`

Don't be verbose, just return the description for the UI based on the event schema and data.
`;

    try {
      const response = await llm.complete({
        prompt: planningPrompt,
        stream: false,
      });

      const responseText = response.text.trim();
      console.log("UI Description:", responseText);

      context.sendEvent(
        writeAggregationEvent.with({
          eventSchema,
          uiDescription: responseText,
        }),
      );
    } catch (error) {
      console.error("Error during UI planning:", error);
      context.sendEvent(stopEvent.with(null));
    }
  });

  genUiWorkflow.handle([writeAggregationEvent], async ({ data: planData }) => {
    const context = getContext();

    const schemaContext = JSON.stringify(planData.eventSchema, null, 2);
    const uiDescriptionContext = planData.uiDescription;

    const writingPrompt = `
# Your role
You are a frontend developer who is developing a React component for given events that are emitted from a backend workflow.
Here are the events that you need to work on: ${schemaContext}
Here is the description of the UI: ${uiDescriptionContext}

# Task
Based on the description of the UI and the list of events, write the aggregation function that will be used to aggregate the events.
Take into account that the list of events grows with time. At the beginning, there is only one event in the list, and events are incrementally added. 
To render the events in a visually pleasing way, try to aggregate them by their attributes and render the aggregates instead of just rendering a list of all events.
Don't add computation to the aggregation function, just group the events by their attributes.
Make sure that the aggregation should reflect the description of the UI and the grouped events are not duplicated, make it as simple as possible to avoid unnecessary issues.

# Answer with the following format:
\`\`\`jsx
const aggregateEvents = () => {
    // code for aggregating events here if needed otherwise let the jsx code block empty
}
\`\`\`
`;

    try {
      const response = await llm.complete({
        prompt: writingPrompt,
        stream: false,
      });

      const generatedCode = response.text.trim();
      context.sendEvent(
        writeUiComponentEvent.with({
          eventSchema: planData.eventSchema,
          uiDescription: planData.uiDescription,
          aggregationFunction: generatedCode,
        }),
      );
    } catch (error) {
      console.error("Error during aggregation function writing:", error);
      context.sendEvent(stopEvent.with(null));
    }
  });

  genUiWorkflow.handle([writeUiComponentEvent], async ({ data: planData }) => {
    const context = getContext();

    const aggregationFunctionContext = planData.aggregationFunction
      ? `
# Here is the aggregation function that aggregates the events:
${planData.aggregationFunction}`
      : "";

    const schemaContext = JSON.stringify(planData.eventSchema, null, 2);
    const uiDescriptionContext = planData.uiDescription;

    const writingPrompt = `
# Your role
You are a frontend developer who is developing a React component using shadcn/ui, lucide-react, LlamaIndex's chat-ui, and tailwind css (cn) for the UI.
You are given a list of events and other context.
Your task is to write a beautiful UI for the events that will be included in a chat UI.

# Context:
Here are the events that you need to work on: ${schemaContext}
${aggregationFunctionContext}
Here is the description of the UI: 
    \`\`\`
    ${uiDescriptionContext}
    \`\`\`


# Only use the following dependencies: ${SUPPORTED_DEPS}

# Requirements:
- Write beautiful UI components for the events using the supported dependencies
- The component text/label should be specified for each event type.


# Instructions:
## Event and schema notice
- Based on the provided list of events, determine their types and attributes.
- It's normal that the schema is applied to all events, but the events might be completely different where some schema attributes aren't used.
- You should make the component visually distinct for each event type.
  e.g: A simple cat schema
    \`\`\`{"type": "cat", "action": ["jump", "run", "meow"], "jump": {"height": 10, "distance": 20}, "run": {"distance": 100}}\`\`\`
    You should display the jump, run and meow actions in different ways. Don't try to render "height" for the "run" and "meow" action.

## UI notice
- Use the supported dependencies for the UI.
- Be careful on state handling, make sure the update should be updated in the state and there is no duplicate state.
- For a long content, consider to use markdown along with dropdown to show the full content.
    e.g:
    \`\`\`jsx
    import { Markdown } from "@llamaindex/chat-ui/widgets";
    <Markdown content={content} />
    \`\`\`
- Try to make the component placement not monotonous, consider use row/column/flex/grid layout.
`;

    try {
      const response = await llm.complete({
        prompt: writingPrompt,
        stream: false,
      });

      const generatedCode = response.text.trim();

      context.sendEvent(
        refineGeneratedCodeEvent.with({
          uiCode: generatedCode,
          aggregationFunction: planData.aggregationFunction || "",
          uiDescription: planData.uiDescription,
        }),
      );
    } catch (error) {
      console.error("Error during UI component writing:", error);
      context.sendEvent(stopEvent.with(null));
    }
  });

  genUiWorkflow.handle(
    [refineGeneratedCodeEvent],
    async ({ data: writeData }) => {
      const context = getContext();

      const refiningPrompt = `
# Your role
You are a senior frontend developer reviewing React code written by a junior developer.

# Context:
- The goal is to create a React component that displays an array of events.
- Required Code Structure (Component accepts an \`events\` array prop):
${CODE_STRUCTURE}
- Aggregation Context (if any): ${writeData.aggregationFunction || "None"}
- Generated Code (may need fixes):
${writeData.uiCode}

# Task:
Review and refine the provided "Generated Code". Ensure it strictly follows the "Required Code Structure" (including accepting the \`events\` array prop), implements any described aggregation logic correctly, imports are correct (individual shadcn/ui imports), and there are no obvious bugs or undefined variables.

# Output Format:
Return ONLY the final, refined code, enclosed in a single JSX code block (\`\`\`jsx ... \`\`\`). Do not add any explanations before or after the code block.
`;

      try {
        const response = await llm.complete({
          prompt: refiningPrompt,
          stream: false,
        });

        let finalCode = response.text.trim();

        // Extract code from markdown block if present (using [^] instead of . with s flag)
        const codeMatch = finalCode.match(/\`\`\`jsx\n?([^]*?)\n?\`\`\`/);
        if (codeMatch && codeMatch[1]) {
          finalCode = codeMatch[1].trim();
        } else {
          // Fallback if no block found - attempt cleanup
          finalCode = finalCode.replace(/^\`\`\`jsx|\`\`\`$/g, "").trim();
          console.warn(
            "Could not find standard JSX code block in refinement response, using raw content.",
          );
        }

        console.log("Refined Code:", finalCode);
        context.sendEvent(stopEvent.with(finalCode));
      } catch (error) {
        console.error("Error during code refining:", error);
      }
    },
  );

  return genUiWorkflow;
}

/**
 * Generates a React UI component for displaying events of a given type.
 * The generated component will expect an 'events' array prop.
 *
 * @param eventType - A Zod schema representing the event type.
 * @param llm - The LLM instance to use for the workflow.
 * @returns The generated React component code as a string.
 */
export async function generateEventComponent(
  eventType: z.ZodTypeAny,
  llm: LLM,
): Promise<string> {
  // Convert Zod schema to JSON schema including descriptions
  const eventSchemaObject = zodToJsonSchema(eventType, { target: "openApi3" });
  console.log(`Starting UI generation...`);

  try {
    // Create the workflow with the provided LLM instance
    const genUiWorkflow = createGenUiWorkflow(llm);

    // Create workflow context and trigger the first event
    const { stream, sendEvent } = genUiWorkflow.createContext();
    sendEvent(planUiEvent.with({ eventSchema: eventSchemaObject }));

    // Collect all events until the stop event and get the last one
    const allEvents = await collect(until(stream, stopEvent));
    const lastEvent = allEvents[allEvents.length - 1];
    if (lastEvent.data === null) {
      throw new Error("Workflow failed.");
    }
    console.log("Workflow finished successfully.");
    return lastEvent.data;
  } catch (error) {
    console.error("Workflow execution failed:", error);
    throw new Error(`UI generation workflow failed: ${error}`);
  }
}

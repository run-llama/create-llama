# LlamaIndex Server

LlamaIndexServer is a Next.js-based application that allows you to quickly launch your [LlamaIndex Workflows](https://ts.llamaindex.ai/docs/llamaindex/modules/agents/workflows) and [Agent Workflows](https://ts.llamaindex.ai/docs/llamaindex/modules/agents/agent_workflow) as an API server with an optional chat UI. It provides a complete environment for running LlamaIndex workflows with both API endpoints and a user interface for interaction.

## Features

- Add a sophisticated chatbot UI to your LlamaIndex workflow
- Edit code and document artifacts in an OpenAI Canvas-style UI
- Extendable UI components for events and headers
- Built on Next.js for high performance and easy API development

## Installation

```bash
npm i @llamaindex/server
```

## Quick Start

Create an `index.ts` file and add the following code:

```ts
import { LlamaIndexServer } from "@llamaindex/server";
import { openai } from "@llamaindex/openai";
import { agent } from "@llamaindex/workflow";
import { wiki } from "@llamaindex/tools"; // or any other tool

const createWorkflow = () => agent({ tools: [wiki()], llm: openai("gpt-4o") });

new LlamaIndexServer({
  workflow: createWorkflow,
  uiConfig: {
    starterQuestions: ["Who is the first president of the United States?"],
  },
}).start();
```

The `createWorkflow` function is a factory function that creates an [Agent Workflow](https://ts.llamaindex.ai/docs/llamaindex/modules/agents/agent_workflow) with a tool that retrieves information from Wikipedia in this case. For more details, read about the [Workflow factory contract](#workflow-factory-contract).

## Running the Server

In the same directory as `index.ts`, run the following command to start the server:

```bash
tsx index.ts
```

The server will start at `http://localhost:3000`

You can also make a request to the server:

```bash
curl -X POST "http://localhost:3000/api/chat" -H "Content-Type: application/json" -d '{"message": "Who is the first president of the United States?"}'
```

## Configuration Options

The `LlamaIndexServer` accepts the following configuration options:

- `workflow`: A callable function that creates a workflow instance for each request. See [Workflow factory contract](#workflow-factory-contract) for more details.
- `uiConfig`: An object to configure the chat UI containing the following properties:
  - `starterQuestions`: List of starter questions for the chat UI (default: `[]`)
  - `componentsDir`: The directory for custom UI components rendering events emitted by the workflow. The default is undefined, which does not render custom UI components.
  - `layoutDir`: The directory for custom layout sections. The default value is `layout`. See [Custom Layout](#custom-layout) for more details.
  - `llamaCloudIndexSelector`: Whether to show the LlamaCloud index selector in the chat UI (requires `LLAMA_CLOUD_API_KEY` to be set in the environment variables) (default: `false`)
  - `dev_mode`: When enabled, you can update workflow code in the UI and see the changes immediately. It's currently in beta and only supports updating workflow code at `app/src/workflow.ts`. Please start server in dev mode (`npm run dev`) to use see this reload feature enabled.
- `suggestNextQuestions`: Whether to suggest next questions after the assistant's response (default: `true`). You can change the prompt for the next questions by setting the `NEXT_QUESTION_PROMPT` environment variable.

LlamaIndexServer accepts all the configuration options from Nextjs Custom Server such as `port`, `hostname`, `dev`, etc.
See all Nextjs Custom Server options [here](https://nextjs.org/docs/app/building-your-application/configuring/custom-server).

## Workflow factory contract

The `workflow` provided will be called for each chat request to initialize a new workflow instance. The contract of the generated workflow must be the same as for the [Agent Workflow](https://ts.llamaindex.ai/docs/llamaindex/modules/agents/agent_workflow).

This means that the workflow must handle a `startAgentEvent` event, which is the entry point of the workflow and contains the following information in it's `data` property:

```typescript
{
  userInput: MessageContent;
  chatHistory?: ChatMessage[] | undefined;
};
```

The `userInput` is the latest user message and the `chatHistory` is the list of messages exchanged between the user and the workflow so far.

Furthermore, the workflow must stop with a `stopAgentEvent` event to mark the end of the workflow. In between, the workflow can emit [UI events](##AI-generated-UI-Components) to render custom UI components and [Artifact events](##Sending-Artifacts-to-the-UI) to send structured data like generated documents or code snippets to the UI.

```ts
import {
  createStatefulMiddleware,
  createWorkflow,
  startAgentEvent,
} from "@llamaindex/workflow";
import { ChatMemoryBuffer, type ChatMessage, Settings } from "llamaindex";
import { openai } from "@llamaindex/openai";
import { wiki } from "@llamaindex/tools";

Settings.llm = openai("gpt-4o");

export const workflowFactory = async () => {
  const workflow = createWorkflow();

  workflow.handle([startAgentEvent], async ({ data }) => {
    const { state, sendEvent } = getContext();
    const messages = data.chatHistory;

    const toolCallResponse = await chatWithTools(
      Settings.llm,
      [wiki()],
      messages,
    );

    // using result from tool call and use `sendEvent` to emit the next event...
  });

  // define more workflow handling logic here...

  // Finally stop with a `stopAgentEvent` event to mark the end of the workflow.
  // return stopAgentEvent.with({
  //   result: "This is the end!",
  // });

  return workflow;
};
```

To generate sophisticated examples of workflows, you best use the [create-llama](https://github.com/run-llama/create-llama) project.

## AI-generated UI Components

The LlamaIndex server provides support for rendering workflow events using custom UI components, allowing you to extend and customize the chat interface.
These components can be auto-generated using an LLM by providing a JSON schema of the workflow event.

### UI Event Schema

To display custom UI components, your workflow needs to emit UI events that have an event type for identification and a data object:

```typescript
class UIEvent extends WorkflowEvent<{
  type: "ui_event";
  data: UIEventData;
}> {}
```

The `data` object can be any JSON object. To enable AI generation of the UI component, you need to provide a schema for that data (here we're using Zod):

```typescript
const MyEventDataSchema = z
  .object({
    stage: z
      .enum(["retrieve", "analyze", "answer"])
      .describe("The current stage the workflow process is in."),
    progress: z
      .number()
      .min(0)
      .max(1)
      .describe("The progress in percent of the current stage"),
  })
  .describe("WorkflowStageProgress");

type UIEventData = z.infer<typeof MyEventDataSchema>;
```

### Generate UI Components

The `generateEventComponent` function uses an LLM to generate a custom UI component based on the JSON schema of a workflow event. The schema should contain accurate descriptions of each field so that the LLM can generate matching components for your use case. We've done this for you in the example above using the `describe` function from Zod:

```typescript
import { OpenAI } from "llamaindex";
import { generateEventComponent } from "@llamaindex/server";
import { MyEventDataSchema } from "./your-workflow";

// Also works well with Claude 3.5 Sonnet and Google Gemini 2.5 Pro
const llm = new OpenAI({ model: "gpt-4.1" });
const code = generateEventComponent(MyEventDataSchema, llm);
```

After generating the code, we need to save it to a file. The file name must match the event type from your workflow (e.g., `ui_event.jsx` for handling events with `ui_event` type):

```ts
fs.writeFileSync("components/ui_event.jsx", code);
```

Feel free to modify the generated code to match your needs. If you're not satisfied with the generated code, we suggest improving the provided JSON schema first or trying another LLM.

> Note that `generateEventComponent` is generating JSX code, but you can also provide a TSX file.

## Custom Layout

LlamaIndex Server supports custom layout for header and footer. To use custom layout, you need to initialize the LlamaIndex server with the `layoutDir` that contains your custom layout files.

```ts
new LlamaIndexServer({
  workflow: createWorkflow,
  uiConfig: {
    layoutDir: "layout",
  },
}).start();
```

```
layout/
  header.tsx
  footer.tsx
```

We currently support custom header and footer for the chat interface. The syntax for these files is the same as events components in components directory.
Note that by default, we are still rendering the default LlamaIndex Header. It's also the fallback when having errors rendering the custom header. Example layout files will be generated in the `layout` directory of your project when creating a new project with `create-llama`.

### Server Setup

To use the generated UI components, you need to initialize the LlamaIndex server with the `componentsDir` that contains your custom UI components:

```ts
new LlamaIndexServer({
  workflow: createWorkflow,
  uiConfig: {
    componentsDir: "components",
  },
}).start();
```

## Sending Artifacts to the UI

LlamaIndex Server supports sending structured data like generated documents or code snippets to the UI as inline artifacts. These artifacts are displayed in a dedicated "Canvas" panel in the chat interface and are embedded directly in the stream response.

### Inline Artifact Structure

To send an artifact, you need to use the `toInlineAnnotation` function from `@llamaindex/server` within an `agentStreamEvent`. The artifact data should include:

- `type`: Always set to `"artifact"` for the top-level type
- `data`: An object containing:
  - `type`: A string indicating the specific type of artifact (e.g., `"document"`, `"code"`)
  - `created_at`: A timestamp (e.g., `Date.now()`) indicating when the artifact was created
  - `data`: An object containing the specific details of the artifact, structure depends on the artifact type

### Sending Inline Artifacts

First, import the necessary functions:

```typescript
import { toInlineAnnotation } from "@llamaindex/server";
import { agentStreamEvent } from "@llamaindex/workflow";
```

Then, within your workflow logic, use `sendEvent` to emit the artifact inline:

```typescript
// Example for a document artifact
sendEvent(
  agentStreamEvent.with({
    delta: toInlineAnnotation({
      type: "artifact",
      data: {
        type: "document", // Specific artifact type
        created_at: Date.now(),
        data: {
          title: "My Generated Document",
          content: "# Hello World\nThis is a markdown document.",
          type: "markdown", // document format: "markdown" | "html"
        },
      },
    }),
    response: "",
    currentAgentName: "assistant",
    raw: "", // Optional: raw content for debugging
  }),
);

// Example for a code artifact
sendEvent(
  agentStreamEvent.with({
    delta: toInlineAnnotation({
      type: "artifact",
      data: {
        type: "code", // Specific artifact type
        created_at: Date.now(),
        data: {
          language: "typescript",
          file_name: "MyComponent.tsx",
          code: `import React from "react";

export default function MyComponent() {
  return <div>Hello World</div>;
}`,
        },
      },
    }),
    response: "",
    currentAgentName: "assistant",
    raw: "",
  }),
);
```

The `toInlineAnnotation` function wraps the artifact data in a special code block format that the UI can parse and render appropriately. This approach embeds artifacts directly in the response stream, making them part of the natural conversation flow.

### Supported Artifact Types

Common artifact types include:

- **`document`**: For markdown or HTML documents with `title`, `content`, and `type` fields
- **`code`**: For code snippets with `language`, `file_name`, and `code` fields

The artifacts will be automatically rendered in the [ChatCanvasPanel](/packages/server/next/app/components/ui/chat/canvas/panel.tsx) by the appropriate renderer based on the artifact type.

## Default Endpoints and Features

### Chat Endpoint

The server includes a default chat endpoint at `/api/chat` for handling chat interactions.

### Chat UI

The server always provides a chat interface at the root path (`/`) with:

- Configurable starter questions
- Real-time chat interface
- API endpoint integration

### Static File Serving

- The server automatically mounts the `data` and `output` folders at `{server_url}{api_prefix}/files/data` (default: `/api/files/data`) and `{server_url}{api_prefix}/files/output` (default: `/api/files/output`) respectively.
- Your workflows can use both folders to store and access files. By convention, the `data` folder is used for documents that are ingested, and the `output` folder is used for documents generated by the workflow.

### Eject Mode

If you want to fully customize the server UI and routes, you can use `npm eject`. It will create a normal Next.js project with the same functionality as @llamaindex/server.
By default, the ejected project will be in the `next` directory in the current working directory. You can change the output directory by providing custom path after `eject` command:

```bash
npm eject <path-to-output-directory>
```

How eject works:

1. Init nextjs project with eslint, prettier, postcss, tailwindcss, shadcn components, etc.
2. Copy your workflow definition and setting files in src/app/\* to the ejected project in app/api/chat
3. Copy your components, data, output, storage folders to the ejected project
4. Copy your current .env file to the ejected project
5. Clean up files that are no longer needed and update imports

## API Reference

- [LlamaIndexServer](https://ts.llamaindex.ai/docs/api/classes/LlamaIndexServer)

# LlamaIndex Server

LlamaIndexServer is a Next.js-based application that allows you to quickly launch your [LlamaIndex Workflows](https://ts.llamaindex.ai/docs/llamaindex/modules/agents/workflows) and [Agent Workflows](https://ts.llamaindex.ai/docs/llamaindex/modules/agents/agent_workflow) as an API server with an optional chat UI. It provides a complete environment for running LlamaIndex workflows with both API endpoints and a user interface for interaction.

## Features

- Serving a workflow as a chatbot
- Built on Next.js for high performance and easy API development
- Optional built-in chat UI with extendable UI components
- Prebuilt development code

## Installation

```bash
npm i @llamaindex/server
```

## Quick Start

Create an `index.ts` file and add the following code:

```ts
import { LlamaIndexServer } from "@llamaindex/server";
import { wiki } from "@llamaindex/tools"; // or any other tool

const createWorkflow = () => agent({ tools: [wiki()] });

new LlamaIndexServer({
  workflow: createWorkflow,
  uiConfig: {
    appTitle: "LlamaIndex App",
    starterQuestions: ["Who is the first president of the United States?"],
  },
}).start();
```

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
  - `appTitle`: The title of the application (default: `"LlamaIndex App"`)
  - `starterQuestions`: List of starter questions for the chat UI (default: `[]`)
  - `componentsDir`: The directory for custom UI components rendering events emitted by the workflow. The default is undefined, which does not render custom UI components.
  - `llamaCloudIndexSelector`: Whether to show the LlamaCloud index selector in the chat UI (requires `LLAMA_CLOUD_API_KEY` to be set in the environment variables) (default: `false`)
  - `dev_mode`: When enabled, you can update workflow code in the UI and see the changes immediately. It's currently in beta and only supports updating workflow code at `app/src/workflow.ts`. Please start server in dev mode (`npm run dev`) to use see this reload feature enabled.

LlamaIndexServer accepts all the configuration options from Nextjs Custom Server such as `port`, `hostname`, `dev`, etc.
See all Nextjs Custom Server options [here](https://nextjs.org/docs/app/building-your-application/configuring/custom-server).

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

### Server Setup

To use the generated UI components, you need to initialize the LlamaIndex server with the `componentsDir` that contains your custom UI components:

```ts
new LlamaIndexServer({
  workflow: createWorkflow,
  uiConfig: {
    appTitle: "LlamaIndex App",
    componentsDir: "components",
  },
}).start();
```

### Workflow factory contract

The `workflow` provided will be called for each chat request to initialize a new workflow instance. Additionally, we provide the fully request body object (req.body), which includes the request information that is helpful for initializing the workflow. For example:

```ts
import { chatWithTools } from "@llamaindex/tools";
import {
  createStatefulMiddleware,
  createWorkflow,
  workflowEvent,
} from "@llamaindex/workflow";
import { ChatMemoryBuffer, type ChatMessage, Settings } from "llamaindex";

export const workflowFactory = async (reqBody: any) => {
  // get messages from request body
  const { messages } = reqBody as { messages: ChatMessage[] };

  // use request body data to initialize the index
  const index = await getIndex(reqBody?.data);
  const queryEngineTool = index.queryTool({
    metadata: {
      name: "query_document",
      description: `This tool can r2etrieve information about Apple and Tesla financial data`,
    },
    includeSourceNodes: true,
  });

  const { withState, getContext } = createStatefulMiddleware(() => ({
    // use messages from request body to initialize the memory
    memory: new ChatMemoryBuffer({ llm, chatHistory: messages }),
  }));

  const workflow = withState(createWorkflow());
  const inputEvent = workflowEvent<{ input: ChatMessage[] }>();

  workflow.handle([inputEvent], async ({ data }) => {
    const { sendEvent, state } = getContext();
    const chatHistory = data.input;
    const toolCallResponse = await chatWithTools(
      Settings.llm,
      [queryEngineTool],
      chatHistory,
    );

    // using result from tool call such as emit an UI event...
  });

  // define more workflow handling logic here...

  return workflow;
};
```

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

## API Reference

- [LlamaIndexServer](https://ts.llamaindex.ai/docs/api/classes/LlamaIndexServer)

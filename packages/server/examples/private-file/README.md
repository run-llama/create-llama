# Upload File Example

This example shows how to use the uploaded file (private file) from the user in the workflow.

## Prerequisites

Please follow the setup instructions in the [examples README](../README.md).

You will also need:

- An OpenAI API key
- The `enableFileUpload` option in the `uiConfig` is set to `true`.

```typescript
new LlamaIndexServer({
  // ... other options
  uiConfig: { enableFileUpload: true },
}).start();
```

## How to get the uploaded files in your workflow:

In LlamaIndexServer, the uploaded file is included in chat message annotations. You can easily get the uploaded files from chat messages using the [extractFileAttachments](https://github.com/llamaindex/llamaindex/blob/main/packages/server/src/utils/events.ts) function.

```typescript
import { type Message } from "ai";
import { extractFileAttachments } from "@llamaindex/server";

async function workflowFactory(reqBody: { messages: Message[] }) {
  const attachments = extractFileAttachments(reqBody.messages);
  // ...
}
```

### AgentWorkflow

If you are using AgentWorkflow, to provide file access to the agent, you can create a tool to read the file content. We recommend to use the `fileId` as the parameter of the tool instead of the `filePath` to avoid showing internal file path to the user. You can use the `getStoredFilePath` helper function to get the file path from the file id.

```typescript
import { getStoredFilePath, extractFileAttachments } from "@llamaindex/server";

const readFileTool = tool(
  ({ fileId }) => {
    // Get the file path from the file id
    const filePath = getStoredFilePath({ id: fileId });
    return fsPromises.readFile(filePath, "utf8");
  },
  {
    name: "read_file",
    description: `Use this tool with the file id to read the file content. The available file are: [${attachments.map((file) => file.id).join(", ")}]`,
    parameters: z.object({
      fileId: z.string(),
    }),
  },
);
```

**Tip:** You can either put the attachments file information to the tool description or agent's system prompt.

Check: [agent-workflow.ts](./agent-workflow.ts) for the full example.

### Custom Workflow

In custom workflow, instead of defining a tool, you can use the helper functions (`extractFileAttachments` and `getStoredFilePath`) to work with file attachments in your workflow.

Check: [custom-workflow.ts](./custom-workflow.ts) for the full example.

> To run custom workflow example, update the `index.ts` file to use the `workflowFactory` from `custom-workflow.ts` instead of `agent-workflow.ts`.

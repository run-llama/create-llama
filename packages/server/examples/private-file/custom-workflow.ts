import { extractFileAttachments } from "@llamaindex/server";
import { ChatMemoryBuffer, MessageContent, Settings } from "llamaindex";

import {
  agentStreamEvent,
  createStatefulMiddleware,
  createWorkflow,
  startAgentEvent,
  stopAgentEvent,
  workflowEvent,
} from "@llamaindex/workflow";
import { Message } from "ai";
import { promises as fsPromises } from "node:fs";

const fileHelperEvent = workflowEvent<{
  userInput: MessageContent;
  fileContent: string;
}>();

/**
 * This is an simple workflow to demonstrate how to use uploaded files in the workflow.
 */
export function workflowFactory(reqBody: { messages: Message[] }) {
  const llm = Settings.llm;

  // First, extract the uploaded file from the messages
  const attachments = extractFileAttachments(reqBody.messages);

  if (attachments.length === 0) {
    throw new Error("Please upload a file to start");
  }

  // Then, add the uploaded file info to the workflow state
  const { withState, getContext } = createStatefulMiddleware(() => {
    return {
      memory: new ChatMemoryBuffer({ llm }),
      uploadedFile: attachments[attachments.length - 1],
    };
  });
  const workflow = withState(createWorkflow());

  // Handle the start of the workflow: read the file content
  workflow.handle([startAgentEvent], async ({ data }) => {
    const { userInput } = data;
    // Prepare chat history
    const { state } = getContext();
    if (!userInput) {
      throw new Error("Missing user input to start the workflow");
    }
    state.memory.put({ role: "user", content: userInput });

    // Read file content
    const fileContent = await fsPromises.readFile(
      state.uploadedFile.path,
      "utf8",
    );

    return fileHelperEvent.with({
      userInput,
      fileContent,
    });
  });

  // Use LLM to help the user with the file content
  workflow.handle([fileHelperEvent], async ({ data }) => {
    const { sendEvent } = getContext();

    const prompt = `
You are a helpful assistant that can help the user with their file.

Here is the provided file content:
${data.fileContent}

Now, let help the user with this request:
${data.userInput}
`;

    const response = await llm.complete({
      prompt,
      stream: true,
    });

    // Stream the response
    for await (const chunk of response) {
      sendEvent(
        agentStreamEvent.with({
          delta: chunk.text,
          response: chunk.text,
          currentAgentName: "agent",
          raw: chunk.raw,
        }),
      );
    }
    sendEvent(stopAgentEvent.with({ result: "" }));
  });

  return workflow;
}

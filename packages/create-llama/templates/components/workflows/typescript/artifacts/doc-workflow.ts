import { createWorkflow, getContext, workflowEvent } from "@llama-flow/core";
import { withStore } from "@llama-flow/core/middleware/store";
import { extractLastArtifact } from "@llamaindex/server";
import {
  ChatMemoryBuffer,
  ChatMessage,
  ChatResponseChunk,
  LLM,
  PromptTemplate,
  Settings,
} from "llamaindex";

import { z } from "zod";

export const DocumentRequirementSchema = z.object({
  type: z.enum(["markdown", "html"]),
  title: z.string(),
  requirement: z.string(),
});

export type DocumentRequirement = z.infer<typeof DocumentRequirementSchema>;

const planEvent = workflowEvent<{
  userInput: string;
  context?: string | undefined;
}>();

const generateArtifactEvent = workflowEvent<{
  requirement: DocumentRequirement;
}>();

const synthesizeAnswerEvent = workflowEvent<{
  requirement: DocumentRequirement;
  generatedArtifact: string;
}>();

const startEvent = workflowEvent<{
  userInput: string;
  chatHistory: ChatMessage[];
}>();
const stopEvent = workflowEvent<AsyncIterable<ChatResponseChunk>>();

const uiEvent = workflowEvent<{
  type: "ui_event";
  data: {
    state: "plan" | "generate" | "completed";
    requirement?: string | undefined;
  };
}>();

const artifactEvent = workflowEvent<{
  type: "artifact";
  data: {
    type: "document";
    created_at: number;
    data: {
      title: string;
      content: string;
      type: "markdown" | "html";
    };
  };
}>();

export function getWorkflow(reqBody: any, llm?: LLM) {
  if (!llm) {
    llm = Settings.llm;
  }
  const workflow = withStore(() => {
    return {
      memory: new ChatMemoryBuffer({
        llm,
        chatHistory: reqBody.chatHistory,
      }),
      lastArtifact: extractLastArtifact(reqBody),
    };
  }, createWorkflow());
  const { getStore } = workflow.createContext();

  workflow.handle(
    [startEvent],
    async ({ data: { userInput, chatHistory } }) => {
      // Prepare chat history
      const { memory } = getStore();
      // Put user input to the memory
      memory.put({
        role: "user",
        content: userInput,
      });
      return planEvent.with({
        userInput,
        context: getStore().lastArtifact
          ? JSON.stringify(getStore().lastArtifact)
          : undefined,
      });
    },
  );

  workflow.handle([planEvent], async ({ data: planData }) => {
    const { sendEvent } = getContext();
    const { memory } = getStore();
    sendEvent(
      uiEvent.with({
        type: "ui_event",
        data: {
          state: "plan",
        },
      }),
    );
    const prompt = new PromptTemplate({
      template: `
       You are a documentation analyst responsible for analyzing the user's request and providing requirements for document generation or update.
       Follow these instructions:
       1. Carefully analyze the conversation history and the user's request to determine what has been done and what the next step should be.
       2. From the user's request, provide requirements for the next step of the document generation or update.
       3. Do not be verbose; only return the requirements for the next step of the document generation or update.
       4. Only the following document types are allowed: "markdown", "html".
       5. The requirement should be in the following format:
          \`\`\`json
          {
              "type": "markdown" | "html",
              "title": string,
              "requirement": string
          }
          \`\`\`

       ## Example:
       User request: Create a project guideline document.
       You should return:
       \`\`\`json
       {
           "type": "markdown",
           "title": "Project Guideline",
           "requirement": "Generate a Markdown document that outlines the project goals, deliverables, and timeline. Include sections for introduction, objectives, deliverables, and timeline."
       }
       \`\`\`

       User request: Add a troubleshooting section to the guideline.
       You should return:
       \`\`\`json
       {
           "type": "markdown",
           "title": "Project Guideline",
           "requirement": "Add a 'Troubleshooting' section at the end of the document with common issues and solutions."
       }
       \`\`\`

       {context}

       Now, please plan for the user's request:
       {user_msg}
      `,
      templateVars: ["context", "user_msg"],
    });

    const response = await llm.complete({
      prompt: prompt.format({
        context: planData.context
          ? `## The context is: \n${planData.context}\n`
          : "",
        user_msg: planData.userInput,
      }),
    });

    // Parse the response to DocumentRequirement
    const jsonBlock = response.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (!jsonBlock) {
      throw new Error("No JSON block found in the response.");
    }

    const requirement = DocumentRequirementSchema.parse(
      JSON.parse(jsonBlock[1]),
    );

    // Put the planning result to the memory
    memory.put({
      role: "assistant",
      content: `Planning for the document generation: \n${response.text}`,
    });

    sendEvent(
      uiEvent.with({
        type: "ui_event",
        data: {
          state: "generate",
          requirement: requirement.requirement,
        },
      }),
    );

    return generateArtifactEvent.with({
      requirement,
    });
  });

  workflow.handle(
    [generateArtifactEvent],
    async ({ data: { requirement } }) => {
      const { sendEvent } = getContext();
      const { memory } = getStore();

      sendEvent(
        uiEvent.with({
          type: "ui_event",
          data: {
            state: "generate",
            requirement: requirement.requirement,
          },
        }),
      );

      const previousArtifact = getStore().lastArtifact
        ? JSON.stringify(getStore().lastArtifact)
        : "";

      const prompt = `
       You are a skilled technical writer who can help users with documentation.
       You are given a task to generate or update a document for a given requirement.

       ## Follow these instructions:
       **1. Carefully read the user's requirements.**
          If any details are ambiguous or missing, make reasonable assumptions and clearly reflect those in your output.
          If the previous document is provided:
          + Carefully analyze the document with the request to make the right changes.
          + Avoid making unnecessary changes from the previous document if the request is not to rewrite it from scratch.
       **2. For document requests:**
          - If the user does not specify a type, default to Markdown.
          - Ensure the document is clear, well-structured, and grammatically correct.
          - Only generate content relevant to the user's request—do not add extra boilerplate.
       **3. Do not be verbose in your response.**
          - No other text or comments; only return the document content wrapped by the appropriate code block (\`\`\`markdown or \`\`\`html).
          - If the user's request is to update the document, only return the updated document.
       **4. Only the following types are allowed: "markdown", "html".**
       **5. If there is no change to the document, return the reason without any code block.**

       ## Example:
       \`\`\`markdown
       # Project Guideline
       
       ## Introduction
       ...
       \`\`\`

       The previous content is:
       ${previousArtifact}

       Now, please generate the document for the following requirement:
       ${JSON.stringify(requirement)}
      `;

      const response = await llm.complete({
        prompt,
      });

      // Extract the document from the response
      const docMatch = response.text.match(/```(markdown|html)([\s\S]*)```/);
      let generatedArtifact = response.text;

      if (docMatch) {
        const content = docMatch[2].trim();
        const docType = docMatch[1] as "markdown" | "html";

        // Put the generated document to the memory
        memory.put({
          role: "assistant",
          content: `Generated document: \n${response.text}`,
        });

        // To show the Canvas panel for the artifact
        sendEvent(
          artifactEvent.with({
            type: "artifact",
            data: {
              type: "document",
              created_at: Date.now(),
              data: {
                title: requirement.title,
                content,
                type: docType,
              },
            },
          }),
        );
      } else {
        // No document changes
        memory.put({
          role: "assistant",
          content: `There is no change to the document: \n${response.text}`,
        });
      }

      return synthesizeAnswerEvent.with({
        requirement,
        generatedArtifact,
      });
    },
  );

  workflow.handle([synthesizeAnswerEvent], async ({ data }) => {
    const { sendEvent } = getContext();
    const { memory } = getStore();

    const chatHistory = await memory.getMessages();
    const messages = [
      ...chatHistory,
      {
        role: "system" as const,
        content: `
        Your responsibility is to explain the work to the user.
        If there is no document to update, explain the reason.
        If the document is updated, just summarize what changed. Don't need to include the whole document again in the response.
        `,
      },
    ];

    const responseStream = await llm.chat({
      messages,
      stream: true,
    });

    sendEvent(
      uiEvent.with({
        type: "ui_event",
        data: {
          state: "completed",
          requirement: data.requirement.requirement,
        },
      }),
    );

    return stopEvent.with(responseStream);
  });

  return workflow;
}

// Test the workflow
const run = async () => {
  const workflow = getWorkflow({
    userMsg: "Create a project guideline document.",
    chatHistory: [],
  });
  const { stream, sendEvent } = workflow.createContext();
  sendEvent(
    startEvent.with({
      userInput: "Create a project guideline document.",
      chatHistory: [],
    }),
  );
  for await (const event of stream) {
    console.log(event.data);
    // If the event is a stop event and contains an async iterable, consume and print its chunks
    if (event.data && typeof event.data[Symbol.asyncIterator] === "function") {
      for await (const chunk of event.data) {
        console.log(chunk.delta);
      }
    }
  }
};

// Uncomment to run
run();

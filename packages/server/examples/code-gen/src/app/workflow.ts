import { artifactEvent, extractLastArtifact } from "@llamaindex/server";
import { ChatMemoryBuffer, MessageContent, Settings } from "llamaindex";

import {
  agentStreamEvent,
  createStatefulMiddleware,
  createWorkflow,
  startAgentEvent,
  stopAgentEvent,
  workflowEvent,
} from "@llamaindex/workflow";

import { z } from "zod";

export const RequirementSchema = z.object({
  next_step: z.enum(["answering", "coding"]),
  language: z.string().nullable().optional(),
  file_name: z.string().nullable().optional(),
  requirement: z.string(),
});

export type Requirement = z.infer<typeof RequirementSchema>;

export const UIEventSchema = z.object({
  type: z.literal("ui_event"),
  data: z.object({
    state: z
      .enum(["plan", "generate", "completed"])
      .describe(
        "The current state of the workflow: 'plan', 'generate', or 'completed'.",
      ),
    requirement: z
      .string()
      .optional()
      .describe(
        "An optional requirement creating or updating a code, if applicable.",
      ),
  }),
});

export type UIEvent = z.infer<typeof UIEventSchema>;
const planEvent = workflowEvent<{
  userInput: MessageContent;
  context?: string | undefined;
}>();

const generateArtifactEvent = workflowEvent<{
  requirement: Requirement;
}>();

const synthesizeAnswerEvent = workflowEvent<object>();

const uiEvent = workflowEvent<UIEvent>();

export function workflowFactory(reqBody: unknown) {
  const llm = Settings.llm;

  const { withState, getContext } = createStatefulMiddleware(() => {
    return {
      memory: new ChatMemoryBuffer({ llm }),
      lastArtifact: extractLastArtifact(reqBody),
    };
  });
  const workflow = withState(createWorkflow());

  workflow.handle([startAgentEvent], async ({ data }) => {
    const { userInput, chatHistory = [] } = data;
    // Prepare chat history
    const { state } = getContext();
    // Put user input to the memory
    if (!userInput) {
      throw new Error("Missing user input to start the workflow");
    }
    state.memory.set(chatHistory);
    state.memory.put({ role: "user", content: userInput });

    return planEvent.with({
      userInput: userInput,
      context: state.lastArtifact
        ? JSON.stringify(state.lastArtifact)
        : undefined,
    });
  });

  workflow.handle([planEvent], async ({ data: planData }) => {
    const { sendEvent } = getContext();
    const { state } = getContext();
    sendEvent(
      uiEvent.with({
        type: "ui_event",
        data: {
          state: "plan",
        },
      }),
    );
    const user_msg = planData.userInput;
    const context = planData.context
      ? `## The context is: \n${planData.context}\n`
      : "";
    const prompt = `
You are a product analyst responsible for analyzing the user's request and providing the next step for code or document generation.
You are helping user with their code artifact. To update the code, you need to plan a coding step.

Follow these instructions:
1. Carefully analyze the conversation history and the user's request to determine what has been done and what the next step should be.
2. The next step must be one of the following two options:
    - "coding": To make the changes to the current code.
    - "answering": If you don't need to update the current code or need clarification from the user.
Important: Avoid telling the user to update the code themselves, you are the one who will update the code (by planning a coding step).
3. If the next step is "coding", you may specify the language ("typescript" or "python") and file_name if known, otherwise set them to null. 
4. The requirement must be provided clearly what is the user request and what need to be done for the next step in details
    as precise and specific as possible, don't be stingy with in the requirement.
5. If the next step is "answering", set language and file_name to null, and the requirement should describe what to answer or explain to the user.
6. Be concise; only return the requirements for the next step.
7. The requirements must be in the following format:
    \`\`\`json
    {
        "next_step": "answering" | "coding",
        "language": "typescript" | "python" | null,
        "file_name": string | null,
        "requirement": string
    }
    \`\`\`

## Example 1:
User request: Create a calculator app.
You should return:
\`\`\`json
{
    "next_step": "coding",
    "language": "typescript",
    "file_name": "calculator.tsx",
    "requirement": "Generate code for a calculator app that has a simple UI with a display and button layout. The display should show the current input and the result. The buttons should include basic operators, numbers, clear, and equals. The calculation should work correctly."
}
\`\`\`

## Example 2:
User request: Explain how the game loop works.
Context: You have already generated the code for a snake game.
You should return:
\`\`\`json
{
    "next_step": "answering",
    "language": null,
    "file_name": null,
    "requirement": "The user is asking about the game loop. Explain how the game loop works."
}
\`\`\`

${context}

Now, plan the user's next step for this request:
${user_msg}
`;

    const response = await llm.complete({
      prompt,
    });
    // parse the response to Requirement
    // 1. use regex to find the json block
    const jsonBlock = response.text.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonBlock) {
      throw new Error("No JSON block found in the response.");
    }
    const requirement = RequirementSchema.parse(JSON.parse(jsonBlock[1]));
    state.memory.put({
      role: "assistant",
      content: `The plan for next step: \n${response.text}`,
    });

    if (requirement.next_step === "coding") {
      return generateArtifactEvent.with({
        requirement,
      });
    } else {
      return synthesizeAnswerEvent.with({});
    }
  });

  workflow.handle([generateArtifactEvent], async ({ data: planData }) => {
    const { sendEvent } = getContext();
    const { state } = getContext();

    sendEvent(
      uiEvent.with({
        type: "ui_event",
        data: {
          state: "generate",
          requirement: planData.requirement.requirement,
        },
      }),
    );

    const previousArtifact = state.lastArtifact
      ? JSON.stringify(state.lastArtifact)
      : "There is no previous artifact";
    const requirementText = planData.requirement.requirement;

    const prompt = `
        You are a skilled developer who can help user with coding.
        You are given a task to generate or update a code for a given requirement.

        ## Follow these instructions:
        **1. Carefully read the user's requirements.** 
           If any details are ambiguous or missing, make reasonable assumptions and clearly reflect those in your output.
           If the previous code is provided:
           + Carefully analyze the code with the request to make the right changes.
           + Avoid making a lot of changes from the previous code if the request is not to write the code from scratch again.
        **2. For code requests:**
           - If the user does not specify a framework or language, default to a React component using the Next.js framework.
           - For Next.js, use Shadcn UI components, Typescript, @types/node, @types/react, @types/react-dom, PostCSS, and TailwindCSS.
           The import pattern should be:
           \`\`\`typescript
           import { ComponentName } from "@/components/ui/component-name"
           import { Markdown } from "@llamaindex/chat-ui"
           import { cn } from "@/lib/utils"
           \`\`\`
           - Ensure the code is idiomatic, production-ready, and includes necessary imports.
           - Only generate code relevant to the user's request—do not add extra boilerplate.
        **3. Don't be verbose on response**
           - No other text or comments only return the code which wrapped by \`\`\`language\`\`\` block.
           - If the user's request is to update the code, only return the updated code.
        **4. Only the following languages are allowed: "typescript", "python".**
        **5. If there is no code to update, return the reason without any code block.**
           
        ## Example:
        \`\`\`typescript
        import React from "react";
        import { Button } from "@/components/ui/button";
        import { cn } from "@/lib/utils";

        export default function MyComponent() {
        return (
           <div className="flex flex-col items-center justify-center h-screen">
              <Button>Click me</Button>
           </div>
        );
        }
        \`\`\`

        The previous code is:
        {previousArtifact}

        Now, i have to generate the code for the following requirement:
        {requirement}
      `
      .replace("{previousArtifact}", previousArtifact)
      .replace("{requirement}", requirementText);

    const response = await llm.complete({
      prompt,
    });

    // Extract the code from the response
    const codeMatch = response.text.match(/```(\w+)([\s\S]*)```/);
    if (!codeMatch) {
      return synthesizeAnswerEvent.with({});
    }

    const code = codeMatch[2].trim();

    // Put the generated code to the memory
    state.memory.put({
      role: "assistant",
      content: `Updated the code: \n${response.text}`,
    });

    // To show the Canvas panel for the artifact
    sendEvent(
      artifactEvent.with({
        type: "artifact",
        data: {
          type: "code",
          created_at: Date.now(),
          data: {
            language: planData.requirement.language || "",
            file_name: planData.requirement.file_name || "",
            code,
          },
        },
      }),
    );

    return synthesizeAnswerEvent.with({});
  });

  workflow.handle([synthesizeAnswerEvent], async () => {
    const { sendEvent } = getContext();
    const { state } = getContext();

    const chatHistory = await state.memory.getMessages();
    const messages = [
      ...chatHistory,
      {
        role: "system" as const,
        content: `
        You are a helpful assistant who is responsible for explaining the work to the user.
        Based on the conversation history, provide an answer to the user's question. 
        The user has access to the code so avoid mentioning the whole code again in your response.
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
        },
      }),
    );

    let response = "";
    for await (const chunk of responseStream) {
      response += chunk.delta;
      sendEvent(
        agentStreamEvent.with({
          delta: chunk.delta,
          response: "",
          currentAgentName: "assistant",
          raw: chunk,
        }),
      );
    }

    return stopAgentEvent.with({
      result: response,
    });
  });

  return workflow;
}

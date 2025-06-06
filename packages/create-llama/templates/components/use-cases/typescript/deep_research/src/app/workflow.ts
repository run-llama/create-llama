import { artifactEvent, toSourceEvent } from "@llamaindex/server";
import {
  agentStreamEvent,
  createStatefulMiddleware,
  createWorkflow,
  startAgentEvent,
  stopAgentEvent,
  workflowEvent,
} from "@llamaindex/workflow";
import {
  ChatMemoryBuffer,
  LlamaCloudIndex,
  MessageContent,
  Metadata,
  MetadataMode,
  NodeWithScore,
  PromptTemplate,
  Settings,
  VectorStoreIndex,
  extractText,
} from "llamaindex";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getIndex } from "./data";

// workflow factory
export const workflowFactory = async (reqBody: any) => {
  const index = await getIndex(reqBody?.data);
  return getWorkflow(index);
};

// workflow configs
const MAX_QUESTIONS = 6; // max number of questions to research, research will stop when this number is reached
const TOP_K = 10; // number of nodes to retrieve from the vector store

const createPlanResearchPrompt = new PromptTemplate({
  template: `
You are a professor who is guiding a researcher to research a specific request/problem.
Your task is to decide on a research plan for the researcher.

The possible actions are:
+ Provide a list of questions for the researcher to investigate, with the purpose of clarifying the request.
+ Write a report if the researcher has already gathered enough research on the topic and can resolve the initial request.
+ Cancel the research if most of the answers from researchers indicate there is insufficient information to research the request. Do not attempt more than 3 research iterations or too many questions.

The workflow should be:
+ Always begin by providing some initial questions for the researcher to investigate.
+ Analyze the provided answers against the initial topic/request. If the answers are insufficient to resolve the initial request, provide additional questions for the researcher to investigate.
+ If the answers are sufficient to resolve the initial request, instruct the researcher to write a report.

Here are the context: 
<Collected information>
{context_str}
</Collected information>

<Conversation context>
{conversation_context}
</Conversation context>

{enhanced_prompt}

Now, provide your decision in the required format for this user request:
<User request>
{user_request}
</User request>
`,
  templateVars: [
    "context_str",
    "conversation_context",
    "enhanced_prompt",
    "user_request",
  ],
});

const researchPrompt = new PromptTemplate({
  template: `
You are a researcher who is in the process of answering the question.
The purpose is to answer the question based on the collected information, without using prior knowledge or making up any new information.
Always add citations to the sentence/point/paragraph using the id of the provided content.
The citation should follow this format: [citation:id] where id is the id of the content.

E.g:
If we have a context like this:
<Citation id='abc-xyz'>
Baby llama is called cria
</Citation id='abc-xyz'>

And your answer uses the content, then the citation should be:
- Baby llama is called cria [citation:abc-xyz]

 Here is the provided context for the question:
<Collected information>
{context_str}
</Collected information>

No prior knowledge, just use the provided context to answer the question: {question}
`,
  templateVars: ["context_str", "question"],
});

const WRITE_REPORT_PROMPT = `
You are a researcher writing a report based on a user request and the research context.
You have researched various perspectives related to the user request.
The report should provide a comprehensive outline covering all important points from the researched perspectives.
Create a well-structured outline for the research report that covers all the answers.

# IMPORTANT when writing in markdown format:
+ Use tables or figures where appropriate to enhance presentation.
+ Preserve all citation syntax (the \`[citation:id]()\` parts in the provided context). Keep these citations in the final report - no separate reference section is needed.
+ Do not add links, a table of contents, or a references section to the report.
`;

// workflow events
type ResearchQuestion = { questionId: string; question: string };
type ResearchResult = ResearchQuestion & { answer: string };

// class PlanResearchEvent extends WorkflowEvent<{}> {}
const planResearchEvent = workflowEvent<{}>();
const researchEvent = workflowEvent<ResearchQuestion>();
const reportEvent = workflowEvent<{}>();

export const UIEventSchema = z
  .object({
    event: z
      .enum(["retrieve", "analyze", "answer"])
      .describe(
        "The type of event. DeepResearch has 3 main stages:\n1. retrieve: Retrieve the context from the vector store\n2. analyze: Analyze the context and generate a research questions to answer\n3. answer: Answer the provided questions. Each question has a unique id, when the state is done, the event will have the answer for the question.",
      ),
    state: z
      .enum(["pending", "inprogress", "done", "error"])
      .describe("The state for each event"),
    id: z.string().optional().describe("The id of the question"),
    question: z
      .string()
      .optional()
      .describe("The question generated by the LLM"),
    answer: z.string().optional().describe("The answer generated by the LLM"),
  })
  .describe("DeepResearchEvent");

type UIEventData = z.infer<typeof UIEventSchema>;

const uiEvent = workflowEvent<{
  type: "ui_event";
  data: UIEventData;
}>();

// workflow definition
export function getWorkflow(index: VectorStoreIndex | LlamaCloudIndex) {
  const retriever = index.asRetriever({ similarityTopK: TOP_K });
  const { withState, getContext } = createStatefulMiddleware(() => {
    return {
      memory: new ChatMemoryBuffer({
        llm: Settings.llm,
        chatHistory: [],
      }),
      contextNodes: [] as NodeWithScore<Metadata>[],
      userRequest: "" as MessageContent,
      totalQuestions: 0,
      researchResults: [] as ResearchResult[],
    };
  });
  const workflow = withState(createWorkflow());

  workflow.handle([startAgentEvent], async ({ data }) => {
    const { userInput, chatHistory = [] } = data;
    const { sendEvent, state } = getContext();
    if (!userInput) throw new Error("Invalid input");

    state.memory.set(chatHistory);
    state.memory.put({ role: "user", content: userInput });
    state.userRequest = userInput;
    sendEvent(
      uiEvent.with({
        type: "ui_event",
        data: {
          event: "retrieve",
          state: "inprogress",
        },
      }),
    );

    const retrievedNodes = await retriever.retrieve({ query: userInput });

    sendEvent(toSourceEvent(retrievedNodes));
    sendEvent(
      uiEvent.with({
        type: "ui_event",
        data: { event: "retrieve", state: "done" },
      }),
    );

    state.contextNodes.push(...retrievedNodes);

    return planResearchEvent.with({});
  });

  workflow.handle([planResearchEvent], async ({ data }) => {
    const { sendEvent, state, stream } = getContext();

    sendEvent(
      uiEvent.with({
        type: "ui_event",
        data: { event: "analyze", state: "inprogress" },
      }),
    );

    const { decision, researchQuestions, cancelReason } =
      await createResearchPlan(
        state.memory,
        state.contextNodes
          .map((node) => node.node.getContent(MetadataMode.NONE))
          .join("\n"),
        enhancedPrompt(state.totalQuestions),
        state.userRequest,
      );

    sendEvent(
      uiEvent.with({
        type: "ui_event",
        data: { event: "analyze", state: "done" },
      }),
    );
    if (decision === "cancel") {
      sendEvent(
        uiEvent.with({
          type: "ui_event",
          data: { event: "analyze", state: "done" },
        }),
      );
      return agentStreamEvent.with({
        delta: cancelReason ?? "Research cancelled without any reason.",
        response: cancelReason ?? "Research cancelled without any reason.",
        currentAgentName: "",
        raw: null,
      });
    }
    if (decision === "research" && researchQuestions.length > 0) {
      state.totalQuestions += researchQuestions.length;
      state.memory.put({
        role: "assistant",
        content:
          "We need to find answers to the following questions:\n" +
          researchQuestions.join("\n"),
      });
      researchQuestions.forEach(({ questionId: id, question }) => {
        sendEvent(
          uiEvent.with({
            type: "ui_event",
            data: { event: "answer", state: "pending", id, question },
          }),
        );
        sendEvent(researchEvent.with({ questionId: id, question }));
      });
      const events = await stream
        .until(() => state.researchResults.length === researchQuestions.length)
        .toArray();
      return planResearchEvent.with({});
    }
    state.memory.put({
      role: "assistant",
      content: "No more idea to analyze. We should report the answers.",
    });
    sendEvent(
      uiEvent.with({
        type: "ui_event",
        data: { event: "analyze", state: "done" },
      }),
    );
    return reportEvent.with({});
  });

  workflow.handle([researchEvent], async ({ data }) => {
    const { sendEvent, state } = getContext();
    const { questionId, question } = data;

    sendEvent(
      uiEvent.with({
        type: "ui_event",
        data: {
          event: "answer",
          state: "inprogress",
          id: questionId,
          question,
        },
      }),
    );

    const answer = await answerQuestion(
      contextStr(state.contextNodes),
      question,
    );
    state.researchResults.push({ questionId, question, answer });

    state.memory.put({
      role: "assistant",
      content: `<Question>${question}</Question>\n<Answer>${answer}</Answer>`,
    });

    sendEvent(
      uiEvent.with({
        type: "ui_event",
        data: {
          event: "answer",
          state: "done",
          id: questionId,
          question,
          answer,
        },
      }),
    );
  });

  workflow.handle([reportEvent], async ({ data }) => {
    const { sendEvent, state } = getContext();
    const chatHistory = await state.memory.getAllMessages();
    const messages = chatHistory.concat([
      {
        role: "system",
        content: WRITE_REPORT_PROMPT,
      },
      {
        role: "user",
        content:
          "Write a report addressing the user request based on the research provided the context",
      },
    ]);

    const stream = await Settings.llm.chat({ messages, stream: true });
    let response = "";
    for await (const chunk of stream) {
      response += chunk.delta;
      sendEvent(
        agentStreamEvent.with({
          delta: chunk.delta,
          response,
          currentAgentName: "",
          raw: stream,
        }),
      );
    }

    // Open the generated report in Canvas
    sendEvent(
      artifactEvent.with({
        type: "artifact",
        data: {
          type: "document",
          created_at: Date.now(),
          data: {
            title: "DeepResearch Report",
            content: response,
            type: "markdown",
            sources: state.contextNodes.map((node) => ({
              id: node.node.id_,
            })),
          },
        },
      }),
    );

    return stopAgentEvent.with({
      result: response,
    });
  });

  return workflow;
}

const createResearchPlan = async (
  memory: ChatMemoryBuffer,
  contextStr: string,
  enhancedPrompt: string,
  userRequest: MessageContent,
) => {
  const chatHistory = await memory.getMessages();

  const conversationContext = chatHistory
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  const prompt = createPlanResearchPrompt.format({
    context_str: contextStr,
    conversation_context: conversationContext,
    enhanced_prompt: enhancedPrompt,
    user_request: extractText(userRequest),
  });

  const responseFormat = z.object({
    decision: z.enum(["research", "write", "cancel"]),
    researchQuestions: z.array(z.string()),
    cancelReason: z.string().optional(),
  });

  const result = await Settings.llm.complete({ prompt, responseFormat });
  const plan = JSON.parse(result.text) as z.infer<typeof responseFormat>;

  return {
    ...plan,
    researchQuestions: plan.researchQuestions.map((question) => ({
      questionId: randomUUID(),
      question,
    })),
  };
};

const contextStr = (contextNodes: NodeWithScore<Metadata>[]) => {
  return contextNodes
    .map((node) => {
      const nodeId = node.node.id_;
      const nodeContent = node.node.getContent(MetadataMode.NONE);
      return `<Citation id='${nodeId}'>\n${nodeContent}</Citation id='${nodeId}'>`;
    })
    .join("\n");
};

const enhancedPrompt = (totalQuestions: number) => {
  if (totalQuestions === 0) {
    return "The student has no questions to research. Let start by providing some questions for the student to research.";
  }

  if (totalQuestions >= MAX_QUESTIONS) {
    return `The student has researched ${totalQuestions} questions. Should proceeding writing report or cancel the research if the answers are not enough to write a report.`;
  }

  return "";
};

const answerQuestion = async (contextStr: string, question: string) => {
  const prompt = researchPrompt.format({
    context_str: contextStr,
    question,
  });
  const result = await Settings.llm.complete({ prompt });
  return result.text;
};

import { toSourceEvent } from "@llamaindex/server";
import {
  AgentInputData,
  AgentWorkflowContext,
  ChatMemoryBuffer,
  ChatResponseChunk,
  HandlerContext,
  Metadata,
  MetadataMode,
  NodeWithScore,
  PromptTemplate,
  Settings,
  StartEvent,
  StopEvent as StopEventBase,
  ToolCallLLM,
  VectorStoreIndex,
  Workflow,
  WorkflowEvent,
} from "llamaindex";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getIndex } from "../data";

// workflow factory
export const workflowFactory = () => new DeepResearchWorkflow();

// workflow configs
const MAX_QUESTIONS = 6; // max number of questions to research, research will stop when this number is reached
const TIMEOUT = 360; // timeout in seconds
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

class PlanResearchEvent extends WorkflowEvent<{}> {}
class ResearchEvent extends WorkflowEvent<ResearchQuestion[]> {}
class ReportEvent extends WorkflowEvent<{}> {}
class StopEvent extends StopEventBase<AsyncGenerator<ChatResponseChunk>> {}

// annotations events
type DeepResearchEventData = {
  event: "retrieve" | "analyze" | "answer";
  state: "pending" | "inprogress" | "done" | "error";
  id?: string;
  question?: string;
  answer?: string;
};

class DeepResearchEvent extends WorkflowEvent<{
  type: "deep_research_event";
  data: DeepResearchEventData;
}> {}

// workflow definition
class DeepResearchWorkflow extends Workflow<
  AgentWorkflowContext,
  AgentInputData,
  string
> {
  #llm = Settings.llm as ToolCallLLM;
  #index?: VectorStoreIndex;

  userRequest: string = "";
  totalQuestions: number = 0;
  contextNodes: NodeWithScore<Metadata>[] = [];
  memory: ChatMemoryBuffer = new ChatMemoryBuffer({ llm: Settings.llm });

  constructor() {
    super({ timeout: TIMEOUT });
    this.addWorkflowSteps();
  }

  addWorkflowSteps() {
    this.addStep(
      {
        inputs: [StartEvent<AgentInputData>],
        outputs: [PlanResearchEvent],
      },
      this.handleStartWorkflow,
    );
    this.addStep(
      {
        inputs: [PlanResearchEvent],
        outputs: [ResearchEvent, ReportEvent, StopEvent],
      },
      this.handlePlanResearch,
    );
    this.addStep(
      {
        inputs: [ResearchEvent],
        outputs: [PlanResearchEvent],
      },
      this.handleResearch,
    );
    this.addStep(
      {
        inputs: [ReportEvent],
        outputs: [StopEvent],
      },
      this.handleReport,
    );
  }

  async initWorkflow(data: AgentInputData) {
    const { userInput, chatHistory = [] } = data;
    if (!userInput) throw new Error("Invalid input");

    this.userRequest = userInput;

    await this.memory.set(chatHistory);
    await this.memory.put({ role: "user", content: userInput });

    const index = await getIndex();

    this.#index = index;
  }

  handleStartWorkflow = async (
    ctx: HandlerContext<AgentWorkflowContext>,
    ev: StartEvent<AgentInputData>,
  ): Promise<PlanResearchEvent> => {
    await this.initWorkflow(ev.data);

    ctx.sendEvent(
      new DeepResearchEvent({
        type: "deep_research_event",
        data: { event: "retrieve", state: "inprogress" },
      }),
    );

    const retrievedNodes = await this.retriever.retrieve(this.userRequest);

    ctx.sendEvent(toSourceEvent(retrievedNodes));

    ctx.sendEvent(
      new DeepResearchEvent({
        type: "deep_research_event",
        data: { event: "retrieve", state: "done" },
      }),
    );

    this.contextNodes = retrievedNodes;

    return new PlanResearchEvent({});
  };

  handlePlanResearch = async (
    ctx: HandlerContext<AgentWorkflowContext>,
    ev: PlanResearchEvent,
  ): Promise<ResearchEvent | ReportEvent | StopEvent> => {
    ctx.sendEvent(
      new DeepResearchEvent({
        type: "deep_research_event",
        data: { event: "analyze", state: "inprogress" },
      }),
    );

    const { decision, researchQuestions, cancelReason } =
      await this.createResearchPlan();

    // Stop workflow due to decision from LLM
    if (decision === "cancel") {
      ctx.sendEvent(
        new DeepResearchEvent({
          type: "deep_research_event",
          data: { event: "analyze", state: "done" },
        }),
      );
      return new StopEvent(
        this.toStreamGenerator(
          cancelReason ?? "Research cancelled without any reason.",
        ),
      );
    }

    // Trigger research from generated questions
    if (decision === "research") {
      this.memory.put({
        role: "assistant",
        content:
          "We need to find answers to the following questions:\n" +
          researchQuestions.join("\n"),
      });

      researchQuestions.forEach(({ questionId: id, question }) => {
        ctx.sendEvent(
          new DeepResearchEvent({
            type: "deep_research_event",
            data: { event: "answer", state: "pending", id, question },
          }),
        );
      });

      return new ResearchEvent(researchQuestions);
    }

    // Resarch done, start writing report
    this.memory.put({
      role: "assistant",
      content: "No more idea to analyze. We should report the answers.",
    });

    ctx.sendEvent(
      new DeepResearchEvent({
        type: "deep_research_event",
        data: { event: "analyze", state: "done" },
      }),
    );

    return new ReportEvent({});
  };

  handleResearch = async (
    ctx: HandlerContext<AgentWorkflowContext>,
    ev: ResearchEvent,
  ): Promise<PlanResearchEvent> => {
    const researchQuestions = ev.data;

    // Answer questions in parallel
    const researchResults: ResearchResult[] = await Promise.all(
      researchQuestions.map(async ({ questionId: id, question }) => {
        ctx.sendEvent(
          new DeepResearchEvent({
            type: "deep_research_event",
            data: { event: "answer", state: "inprogress", id, question },
          }),
        );

        const answer = await this.answerQuestion(question);

        ctx.sendEvent(
          new DeepResearchEvent({
            type: "deep_research_event",
            data: { event: "answer", state: "done", id, question, answer },
          }),
        );

        return { questionId: id, question, answer };
      }),
    );

    // Save answers to memory
    researchResults.forEach(({ question, answer }) => {
      this.memory.put({
        role: "assistant",
        content: `<Question>${question}</Question>\n<Answer>${answer}</Answer>`,
      });
    });

    this.memory.put({
      role: "assistant",
      content:
        "Researched all the questions. Now, I need to analyze if it's ready to write a report or need to research more.",
    });

    this.totalQuestions += researchResults.length;

    return new PlanResearchEvent({});
  };

  handleReport = async (
    ctx: HandlerContext<AgentWorkflowContext>,
    ev: ReportEvent,
  ): Promise<StopEvent> => {
    const chatHistory = await this.memory.getAllMessages();

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

    const stream = await this.llm.chat({ messages, stream: true });

    return new StopEvent(this.toStreamGenerator(stream));
  };

  get llm() {
    if (!this.#llm.supportToolCall) throw new Error("LLM is not a ToolCallLLM");
    return this.#llm;
  }

  get retriever() {
    if (!this.#index) throw new Error("Index is not initialized");
    return this.#index.asRetriever({ similarityTopK: TOP_K });
  }

  get contextStr() {
    return this.contextNodes
      .map((node) => {
        const nodeId = node.node.id_;
        const nodeContent = node.node.getContent(MetadataMode.NONE);
        return `<Citation id='${nodeId}'>\n${nodeContent}</Citation id='${nodeId}'>`;
      })
      .join("\n");
  }

  get enhancedPrompt() {
    if (this.totalQuestions === 0) {
      return "The student has no questions to research. Let start by asking some questions.";
    }

    if (this.totalQuestions > MAX_QUESTIONS) {
      return `The student has researched ${this.totalQuestions} questions. Should cancel the research if the context is not enough to write a report.`;
    }

    return "";
  }

  async createResearchPlan() {
    const chatHistory = await this.memory.getMessages();

    const conversationContext = chatHistory
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");

    const prompt = createPlanResearchPrompt.format({
      context_str: this.contextStr,
      conversation_context: conversationContext,
      enhanced_prompt: this.enhancedPrompt,
      user_request: this.userRequest,
    });

    const responseFormat = z.object({
      decision: z.enum(["research", "write", "cancel"]),
      researchQuestions: z.array(z.string()),
      cancelReason: z.string().optional(),
    });

    const result = await this.llm.complete({ prompt, responseFormat });
    const plan = JSON.parse(result.text) as z.infer<typeof responseFormat>;

    return {
      ...plan,
      researchQuestions: plan.researchQuestions.map((question) => ({
        questionId: randomUUID(),
        question,
      })),
    };
  }

  async answerQuestion(question: string) {
    const prompt = researchPrompt.format({
      context_str: this.contextStr,
      question,
    });
    const result = await this.llm.complete({ prompt });
    return result.text;
  }

  async *toStreamGenerator(input: AsyncIterable<ChatResponseChunk> | string) {
    if (typeof input === "string") {
      yield { delta: input } as ChatResponseChunk;
      return;
    }

    for await (const chunk of input) {
      yield chunk;
    }
  }
}

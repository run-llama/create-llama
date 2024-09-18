import { StepFunction, Workflow } from "@llamaindex/core/workflow";
import { ChatMessage } from "llamaindex";
import { FunctionCallingAgent } from "../agents/single";
import { createResearcher } from "./researcher";

// TODO: implement
class BlogPostWorkflow extends Workflow {}

export async function createWorkflow(chatHistory: ChatMessage[]) {
  const researcher = await createResearcher(chatHistory);
  const writer = new FunctionCallingAgent({
    name: "writer",
    role: "expert in writing blog posts",
    systemPrompt:
      "You are an expert in writing blog posts. You are given a task to write a blog post. Don't make up any information yourself.",
    chatHistory: chatHistory,
  });
  const reviewer = new FunctionCallingAgent({
    name: "reviewer",
    role: "expert in reviewing blog posts",
    systemPrompt:
      "You are an expert in reviewing blog posts. You are given a task to review a blog post. Review the post for logical inconsistencies, ask critical questions, and provide suggestions for improvement. Furthermore, proofread the post for grammar and spelling errors. Only if the post is good enough for publishing, then you MUST return 'The post is good.'. In all other cases return your review.",
    chatHistory: chatHistory,
  });
  const workflow = new BlogPostWorkflow();

  // FIXME: Workflow in LITS doesn't support adding workflows
  // like in Python (workflow.addWorkflows), so we have to add steps manually
  const steps = [...researcher.steps, ...writer.steps, ...reviewer.steps];
  steps.forEach((step) =>
    workflow.addStep(step.step, step.handler as StepFunction, step.params),
  );

  return workflow;
}

import { ChatMessage } from "llamaindex";
import { FunctionCallingAgent } from "./single-agent";
import { lookupTools } from "./tools";

export const createResearcher = async (chatHistory: ChatMessage[]) => {
  const tools = await lookupTools([
    "query_index",
    "wikipedia.WikipediaToolSpec",
    "duckduckgo_search",
  ]);

  return new FunctionCallingAgent({
    name: "researcher",
    tools: tools,
    systemPrompt: `You are a researcher agent. 
You are given a researching task. You must use tools to retrieve information needed for the task.
It's normal that the task include some ambiguity which you must identify what is the real request that need to retrieve information.
If you don't found any related information, please return "I didn't find any information."
Example:
Request: "Create a blog post about the history of the internet, write in English and publish in PDF format."
->
Your task: Looking for information/images in English about the history of the Internet
This is not your task: Create blog post, create PDF, write in English`,
    chatHistory,
  });
};

export const createWriter = (chatHistory: ChatMessage[]) => {
  return new FunctionCallingAgent({
    name: "writer",
    systemPrompt: `You are an expert in writing blog posts. 
You are given a task to write a blog post. Don't make up any information yourself. 
It's normal that the task include some ambiguity, so you must be define what is the starter request of the user to write the post correctly.
Example:
Task: "Here is the information i found about the history of internet: 
Create a blog post about the history of the internet, write in English and publish in PDF format."
-> Your task: Use the research content {...}  to write a blog post in English.
-> This is not your task: Create PDF`,
    chatHistory,
  });
};

export const createReviewer = (chatHistory: ChatMessage[]) => {
  return new FunctionCallingAgent({
    name: "reviewer",
    systemPrompt: `You are an expert in reviewing blog posts. 
You are given a task to review a blog post. 
Review the post for logical inconsistencies, ask critical questions, and provide suggestions for improvement. 
Furthermore, proofread the post for grammar and spelling errors. 
Only if the post is good enough for publishing, then you MUST return 'The post is good.'. In all other cases return your review.
It's normal that the task include some ambiguity, so you must be define what is the starter request of the user to review the post correctly.
Example:
Task: "Create a blog post about the history of the internet, write in English and publish in PDF format."
-> Your task: Review is the main content of the post is about the history of the internet, is it written in English.
-> This is not your task: Create blog post, create PDF, write in English.`,
    chatHistory,
  });
};

export const createPublisher = async (chatHistory: ChatMessage[]) => {
  const tools = await lookupTools(["document_generator"]);
  let systemPrompt =
    "You are an expert in publishing blog posts. You are given a task to publish a blog post.";
  if (tools.length > 0) {
    systemPrompt = `${systemPrompt}. If user requests to generate a file, use the document_generator tool to generate the file and reply the link to the file.`;
  }
  return new FunctionCallingAgent({
    name: "publisher",
    tools: tools,
    systemPrompt: systemPrompt,
    chatHistory,
  });
};

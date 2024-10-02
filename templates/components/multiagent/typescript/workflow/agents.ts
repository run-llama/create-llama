import { ChatMessage } from "llamaindex";
import { FunctionCallingAgent } from "./single-agent";
import { lookupTools } from "./tools";

export const createResearcher = async (chatHistory: ChatMessage[]) => {
  const tools = await lookupTools([
    "query_index",
    "wikipedia_tool",
    "duckduckgo_search",
    "image_generator",
  ]);

  return new FunctionCallingAgent({
    name: "researcher",
    tools: tools,
    systemPrompt: `You are a researcher agent. You are given a researching task. 
If the conversation already included the information and there is no new request for a new information from the user, you should return the appropriate content to the writer.
Otherwise, you must use tools to retrieve information needed for the task.
It's normal that the task include some ambiguity which you must always think carefully about the context of the user request to understand what is the real request that need to retrieve information
If you called the tools but don't found any related information, please return "I didn't find any new information for {the topic}.". Don't try to make up information yourself.
If the request don't need for any new information because it was in the conversation history, please return "The task don't need any new information. Please reuse the old content in the conversation history.".
Example:
Request: "Create a blog post about the history of the internet, write in English and publish in PDF format."
->
Your task: Looking for information in English about the history of the Internet
This is not your task: Create blog post, looking for how to create a PDF

Next request: "Publish the blog post in HTML format."
->
Your task: Return the previous content of the post to the writer. Don't need to do any research.
This is not your task: looking for how to create a HTML file.
`,
    chatHistory,
  });
};

export const createWriter = (chatHistory: ChatMessage[]) => {
  return new FunctionCallingAgent({
    name: "writer",
    systemPrompt: `You are an expert in writing blog posts. 
You are given a task to write a blog post from the research content provided by the researcher agent. Don't make up any information yourself. 
It's important to read the whole conversation history to write the blog post correctly.
If you received a review from the reviewer, update the post with the review and return the new post content.
If user request for an update with an new thing but there is no research content provided, you must return "I don't have any research content to write about."
If the content is not valid (ex: broken link, broken image, etc.) don't use it.
It's normal that the task include some ambiguity, so you must be define what is the starter request of the user to write the post correctly.
If you updated the post for the reviewer, please firstly reply what did you change in the post and then return the new post content.
Example:
Task: "Here is the information i found about the history of internet: 
Create a blog post about the history of the internet, write in English and publish in PDF format."
-> Your task: Use the research content {...}  to write a blog post in English.
-> This is not your task: Create PDF
Please note that a localhost link is fine, but a dummy one like "example.com" or "your-website.com" is not valid.`,
    chatHistory,
  });
};

export const createReviewer = (chatHistory: ChatMessage[]) => {
  return new FunctionCallingAgent({
    name: "reviewer",
    systemPrompt: `You are an expert in reviewing blog posts. 
You are given a task to review a blog post. As a reviewer, it's important that your review is matching with the user request. Please focus on the user request to review the post.
Review the post for logical inconsistencies, ask critical questions, and provide suggestions for improvement. 
Furthermore, proofread the post for grammar and spelling errors. 
Only if the post is good enough for publishing, then you MUST return 'The post is good.'. In all other cases return your review.
It's normal that the task include some ambiguity, so you must be define what is the starter request of the user to review the post correctly.
Please note that a localhost link is fine, but a dummy one like "example.com" or "your-website.com" is not valid.
Example:
Task: "Create a blog post about the history of the internet, write in English and publish in PDF format."
-> Your task: Review is the main content of the post is about the history of the internet, is it written in English.
-> This is not your task: Create blog post, create PDF, write in English.`,
    chatHistory,
  });
};

export const createPublisher = async (chatHistory: ChatMessage[]) => {
  const tools = await lookupTools(["document_generator"]);
  let systemPrompt = `You are an expert in publishing blog posts. You are given a task to publish a blog post. 
If the writer say that there was an error you should reply with the error and not publish the post.`;
  if (tools.length > 0) {
    systemPrompt = `${systemPrompt}. 
If user requests to generate a file, use the document_generator tool to generate the file and reply the link to the file.
Otherwise, just return the content of the post.`;
  }
  return new FunctionCallingAgent({
    name: "publisher",
    tools: tools,
    systemPrompt: systemPrompt,
    chatHistory,
  });
};

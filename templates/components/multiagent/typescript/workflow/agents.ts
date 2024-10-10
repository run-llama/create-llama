import { ChatMessage } from "llamaindex";
import { FunctionCallingAgent } from "./single-agent";
import { getQueryEngineTool, lookupTools } from "./tools";

export const createResearcher = async (
  chatHistory: ChatMessage[],
  params?: any,
) => {
  const queryEngineTool = await getQueryEngineTool(params);
  const tools = (
    await lookupTools([
      "wikipedia_tool",
      "duckduckgo_search",
      "image_generator",
    ])
  ).concat(queryEngineTool ? [queryEngineTool] : []);

  return new FunctionCallingAgent({
    name: "researcher",
    tools: tools,
    systemPrompt: `You are a researcher agent. You are given a research task.
            
If the conversation already includes the information and there is no new request for additional information from the user, you should return the appropriate content to the writer.
Otherwise, you must use tools to retrieve information or images needed for the task.

It's normal for the task to include some ambiguity. You must always think carefully about the context of the user's request to understand what are the main content needs to be retrieved.
Example:
    Request: "Create a blog post about the history of the internet, write in English and publish in PDF format."
    ->Though: The main content is "history of the internet", while "write in English and publish in PDF format" is a requirement for other agents.
    Your task: Look for information in English about the history of the Internet.
    This is not your task: Create a blog post or look for how to create a PDF.

    Next request: "Publish the blog post in HTML format."
    ->Though: User just asking for a format change, the previous content is still valid.
    Your task: Return the previous content of the post to the writer. No need to do any research.
    This is not your task: Look for how to create an HTML file.

If you use the tools but don't find any related information, please return "I didn't find any new information for {the topic}." along with the content you found. Don't try to make up information yourself.
If the request doesn't need any new information because it was in the conversation history, please return "The task doesn't need any new information. Please reuse the existing content in the conversation history.
`,
    chatHistory,
  });
};

export const createWriter = (chatHistory: ChatMessage[]) => {
  return new FunctionCallingAgent({
    name: "writer",
    systemPrompt: `You are an expert in writing blog posts.
You are given the task of writing a blog post based on research content provided by the researcher agent. Do not invent any information yourself. 
It's important to read the entire conversation history to write the blog post accurately.
If you receive a review from the reviewer, update the post according to the feedback and return the new post content.
If the content is not valid (e.g., broken link, broken image, etc.), do not use it.
It's normal for the task to include some ambiguity, so you must define the user's initial request to write the post correctly.
If you update the post based on the reviewer's feedback, first explain what changes you made to the post, then provide the new post content. Do not include the reviewer's comments.
Example:
    Task: "Here is the information I found about the history of the internet: 
    Create a blog post about the history of the internet, write in English, and publish in PDF format."
    -> Your task: Use the research content {...} to write a blog post in English.
    -> This is not your task: Create a PDF
    Please note that a localhost link is acceptable, but dummy links like "example.com" or "your-website.com" are not valid.`,
    chatHistory,
  });
};

export const createReviewer = (chatHistory: ChatMessage[]) => {
  return new FunctionCallingAgent({
    name: "reviewer",
    systemPrompt: `You are an expert in reviewing blog posts.
You are given a task to review a blog post. As a reviewer, it's important that your review aligns with the user's request. Please focus on the user's request when reviewing the post.
Review the post for logical inconsistencies, ask critical questions, and provide suggestions for improvement.
Furthermore, proofread the post for grammar and spelling errors.
Only if the post is good enough for publishing should you return 'The post is good.' In all other cases, return your review.
It's normal for the task to include some ambiguity, so you must define the user's initial request to review the post correctly.
Please note that a localhost link is acceptable, but dummy links like "example.com" or "your-website.com" are not valid.
Example:
    Task: "Create a blog post about the history of the internet, write in English and publish in PDF format."
    -> Your task: Review whether the main content of the post is about the history of the internet and if it is written in English.
    -> This is not your task: Create blog post, create PDF, write in English.`,
    chatHistory,
  });
};

export const createPublisher = async (chatHistory: ChatMessage[]) => {
  const tools = await lookupTools(["document_generator"]);
  let systemPrompt = `You are an expert in publishing blog posts. You are given a task to publish a blog post. 
If the writer says that there was an error, you should reply with the error and not publish the post.`;
  if (tools.length > 0) {
    systemPrompt = `${systemPrompt}. 
If the user requests to generate a file, use the document_generator tool to generate the file and reply with the link to the file.
Otherwise, simply return the content of the post.`;
  }
  return new FunctionCallingAgent({
    name: "publisher",
    tools: tools,
    systemPrompt: systemPrompt,
    chatHistory,
  });
};

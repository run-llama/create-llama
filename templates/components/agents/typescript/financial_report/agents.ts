import { ChatMessage } from "llamaindex";
import { FunctionCallingAgent } from "./single-agent";
import { getQueryEngineTools, lookupTools } from "./tools";

export const createResearcher = async (
  chatHistory: ChatMessage[],
  params?: any,
) => {
  const queryEngineTools = await getQueryEngineTools(params);

  if (!queryEngineTools) {
    throw new Error("Query engine tool not found");
  }

  return new FunctionCallingAgent({
    name: "researcher",
    tools: queryEngineTools,
    systemPrompt: `You are a researcher agent. You are responsible for retrieving information from the corpus.
## Instructions:
+ Don't synthesize the information, just return the whole retrieved information.
+ Don't need to retrieve the information that is already provided in the chat history and respond with: "There is no new information, please reuse the information from the conversation."
`,
    chatHistory,
  });
};

export const createAnalyst = async (chatHistory: ChatMessage[]) => {
  let systemPrompt = `You are an expert in analyzing financial data.
You are given a task and a set of financial data to analyze. Your task is to analyze the financial data and return a report.
Your response should include a detailed analysis of the financial data, including any trends, patterns, or insights that you find.
Construct the analysis in textual format; including tables would be great!
Don't need to synthesize the data, just analyze and provide your findings.
Always use the provided information, don't make up any information yourself.`;
  const tools = await lookupTools(["interpreter"]);
  if (tools.length > 0) {
    systemPrompt = `${systemPrompt}
You are able to visualize the financial data using code interpreter tool.
It's very useful to create and include visualizations in the report. Never include any code in the report, just the visualization.`;
  }
  return new FunctionCallingAgent({
    name: "analyst",
    tools: tools,
    chatHistory,
  });
};

export const createReporter = async (chatHistory: ChatMessage[]) => {
  const tools = await lookupTools(["document_generator"]);
  let systemPrompt = `You are a report generation assistant tasked with producing a well-formatted report given parsed context.
Given a comprehensive analysis of the user request, your task is to synthesize the information and return a well-formatted report.

## Instructions
You are responsible for representing the analysis in a well-formatted report. If tables or visualizations are provided, add them to the most relevant sections.
Finally, the report should be presented in markdown format.`;
  if (tools.length > 0) {
    systemPrompt = `${systemPrompt}. 
You are also able to generate an HTML file of the report.`;
  }
  return new FunctionCallingAgent({
    name: "reporter",
    tools: tools,
    systemPrompt: systemPrompt,
    chatHistory,
  });
};

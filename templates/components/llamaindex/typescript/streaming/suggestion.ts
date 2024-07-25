import { ChatMessage, Settings } from "llamaindex";

const NEXT_QUESTION_PROMPT_TEMPLATE = `You're a helpful assistant! Your task is to suggest the next question that user might ask. 
Here is the conversation history
---------------------
$conversation
---------------------
Given the conversation history, please give me $number_of_questions questions that you might ask next!
Your answer should be wrapped in three sticks which follows the following format:
\`\`\`
<question 1>
<question 2>\`\`\`
`;
const N_QUESTIONS_TO_GENERATE = 3;

export async function generateNextQuestions(
  conversation: ChatMessage[],
  numberOfQuestions: number = N_QUESTIONS_TO_GENERATE,
) {
  const llm = Settings.llm;

  // Format conversation
  const conversationText = conversation
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const message = NEXT_QUESTION_PROMPT_TEMPLATE.replace(
    "$conversation",
    conversationText,
  ).replace("$number_of_questions", numberOfQuestions.toString());

  try {
    const response = await llm.complete({ prompt: message });
    const questions = extractQuestions(response.text);
    return questions;
  } catch (error) {
    console.error("Error: ", error);
    throw error;
  }
}

// TODO: instead of parsing the LLM's result we can use structured predict, once LITS supports it
function extractQuestions(text: string): string[] {
  // Extract the text inside the triple backticks
  // @ts-ignore
  const contentMatch = text.match(/```(.*?)```/s);
  const content = contentMatch ? contentMatch[1] : "";

  // Split the content by newlines to get each question
  const questions = content
    .split("\n")
    .map((question) => question.trim())
    .filter((question) => question !== "");

  return questions;
}

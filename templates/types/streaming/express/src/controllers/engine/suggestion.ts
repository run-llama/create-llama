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

function extractQuestions(text: string): string[] {
  // Extract the text inside the triple backticks
  const contentMatch = text.match(/```(.*?)```/s);
  const content = contentMatch ? contentMatch[1] : "";

  // Split the content by newlines to get each question
  const questions = content
    .split("\n")
    .map((question) => question.trim())
    .filter((question) => question !== "");

  return questions;
}

export function generateNextQuestions(
  conversation: ChatMessage[],
  numberOfQuestions: number = 3,
  onComplete?: (result: string[]) => void,
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

  return llm
    .complete({ prompt: message })
    .then((response) => {
      const questions = extractQuestions(response.text);
      onComplete?.(questions);
    })
    .catch((error) => {
      console.error("Error: ", error);
      throw error;
    });
}

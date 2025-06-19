import { getProQuestionResults } from "./pro";
import { askSimpleQuestions } from "./simple";
import { QuestionArgs, QuestionResults } from "./types";

export const askQuestions = async (
  args: QuestionArgs,
): Promise<QuestionResults> => {
  if (process.argv.length > 2) {
    return await getProQuestionResults(args);
  }
  return await askSimpleQuestions(args);
};

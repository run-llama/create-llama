import ciInfo from "ci-info";
import { askProQuestions } from "./questions";
import { askSimpleQuestions } from "./simple";
import { QuestionArgs, QuestionResults } from "./types";

export const askQuestions = async (
  program: QuestionArgs,
): Promise<QuestionResults> => {
  if (ciInfo.isCI || program.pro) {
    await askProQuestions(program as unknown as QuestionArgs);
    return program as unknown as QuestionResults;
  }
  return await askSimpleQuestions(program as unknown as QuestionArgs);
};

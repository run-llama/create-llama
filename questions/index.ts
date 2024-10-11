import { askProQuestions, QuestionArgs, QuestionResults } from "./questions";
import { askSimpleQuestions } from "./simple";

export const askQuestions = async (
  program: QuestionArgs,
  preferences: QuestionArgs,
  openAiKey?: string,
): Promise<QuestionResults> => {
  if (program.pro) {
    await askProQuestions(
      program as unknown as QuestionArgs,
      preferences,
      openAiKey,
    );
    return program as unknown as QuestionResults;
  }
  return await askSimpleQuestions(
    program as unknown as QuestionArgs,
    openAiKey,
  );
};

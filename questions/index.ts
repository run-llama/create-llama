import ciInfo from "ci-info";
import { getCIQuestionResults } from "./ci";
import { askProQuestions } from "./questions";
import { askSimpleQuestions } from "./simple";
import { QuestionArgs, QuestionResults } from "./types";

export const askQuestions = async (
  program: QuestionArgs,
): Promise<QuestionResults> => {
  if (ciInfo.isCI) {
    return await getCIQuestionResults(program);
  } else if (program.pro) {
    // TODO: refactor pro questions to return a result object
    await askProQuestions(program as unknown as QuestionArgs);
    return program as unknown as QuestionResults;
  }
  return await askSimpleQuestions(program as unknown as QuestionArgs);
};

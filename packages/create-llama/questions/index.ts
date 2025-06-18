import ciInfo from "ci-info";
import { getCIQuestionResults } from "./ci";
import { askSimpleQuestions } from "./simple";
import { QuestionArgs, QuestionResults } from "./types";

export const isCI = ciInfo.isCI || process.env.PLAYWRIGHT_TEST === "1";

export const askQuestions = async (
  args: QuestionArgs,
): Promise<QuestionResults> => {
  if (isCI) {
    return await getCIQuestionResults(args);
  }
  return await askSimpleQuestions(args);
};

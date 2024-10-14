import ciInfo from "ci-info";
import { getCIQuestionResults } from "./ci";
import { askProQuestions } from "./questions";
import { askSimpleQuestions } from "./simple";
import { QuestionArgs, QuestionResults } from "./types";

export const askQuestions = async (
  args: QuestionArgs,
): Promise<QuestionResults> => {
  if (ciInfo.isCI) {
    return await getCIQuestionResults(args);
  } else if (args.pro) {
    // TODO: refactor pro questions to return a result object
    await askProQuestions(args);
    return args as unknown as QuestionResults;
  }
  return await askSimpleQuestions(args);
};

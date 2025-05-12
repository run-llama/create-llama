import ciInfo from "ci-info";
import { bold, yellow } from "picocolors";
import { getCIQuestionResults } from "./ci";
import { askProQuestions } from "./questions";
import { askSimpleQuestions } from "./simple";
import { QuestionArgs, QuestionResults } from "./types";

export const isCI = ciInfo.isCI || process.env.PLAYWRIGHT_TEST === "1";

export const askQuestions = async (
  args: QuestionArgs,
): Promise<QuestionResults> => {
  if (isCI) {
    return await getCIQuestionResults(args);
  } else if (args.pro) {
    // TODO: refactor pro questions to return a result object
    console.log(
      yellow(
        `Pro mode is deprecated. Please use the new templates using the ${bold("LlamaIndexServer")} by not specifying pro mode.`,
      ),
    );

    await askProQuestions(args);
    return args as unknown as QuestionResults;
  }
  const results = await askSimpleQuestions(args);
  return results;
};

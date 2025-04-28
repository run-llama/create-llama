import { Settings } from "llamaindex";
import { getWorkflow } from "./code-workflow";

export const workflowFactory = async (reqBody: any) => {
  return getWorkflow(reqBody, Settings.llm);
};

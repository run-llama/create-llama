import { createCodeArtifactWorkflow } from "./code_workflow";

export const workflowFactory = async (reqBody: any) => {
  const workflow = createCodeArtifactWorkflow(reqBody);

  return workflow;
};

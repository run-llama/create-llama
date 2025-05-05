// import { createCodeArtifactWorkflow } from "./code_workflow";
import { createDocumentArtifactWorkflow } from "./doc-workflow";

export const workflowFactory = async (reqBody: any) => {
  // Uncomment the import and change to createCodeArtifactWorkflow to use the code workflow
  const workflow = createDocumentArtifactWorkflow(reqBody);

  return workflow;
};

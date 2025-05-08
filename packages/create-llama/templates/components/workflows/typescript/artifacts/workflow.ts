// import { createCodeArtifactWorkflow, UIEventSchema } from "./code-workflow";
import { createDocumentArtifactWorkflow, UIEventSchema } from "./doc-workflow";

export const workflowFactory = async (reqBody: any) => {
  // Uncomment the import and change to createCodeArtifactWorkflow to use the code workflow
  const workflow = createDocumentArtifactWorkflow(reqBody);

  return workflow;
};

// Re-export the UIEventSchema for generating the UI by `pnpm generate:ui` command
export { UIEventSchema };

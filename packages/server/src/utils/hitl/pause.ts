import { request, type WorkflowContext } from "@llamaindex/workflow";
import { humanResponseEvent } from "./events";
import { ensureSnapshotWorkflowContext, saveSnapshot } from "./snapshot";

// pause the workflow and save the snapshot
export const pauseForHumanInput = async (
  context: WorkflowContext,
  requestId?: string,
) => {
  if (!requestId) {
    throw new Error("Request id is required to pause the workflow");
  }

  const snapshotWorkflowContext = ensureSnapshotWorkflowContext(context);
  const { snapshot, sendEvent } = snapshotWorkflowContext;

  // send a request event to save the missing step (`humanResponseEvent`) to the snapshot
  sendEvent(request(humanResponseEvent));

  // get and save snapshot
  const [_, snapshotData] = await snapshot();
  await saveSnapshot(requestId, snapshotData);
};

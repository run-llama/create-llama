import { request, type WorkflowContext } from "@llamaindex/workflow";
import { randomUUID } from "node:crypto";
import { humanResponseEvent } from "./events";
import { ensureSnapshotWorkflowContext, saveSnapshot } from "./snapshot";

// pause the workflow and save the snapshot
export const pauseForHumanInput = async (
  context: WorkflowContext,
  requestId: string = randomUUID(), // automatically generate a request id if not provided
) => {
  const snapshotWorkflowContext = ensureSnapshotWorkflowContext(context);
  const { snapshot, sendEvent } = snapshotWorkflowContext;

  // send a request event to save the missing step (`humanResponseEvent`) to the snapshot
  sendEvent(request(humanResponseEvent));

  // get and save snapshot
  const [_, snapshotData] = await snapshot();
  await saveSnapshot(requestId, snapshotData);
};

import { type Workflow } from "@llamaindex/workflow";
import type { HumanResponseEventData } from "./events";
import {
  ensureSnapshotWorkflow,
  loadSnapshot,
  type SnapshotWorkflowContext,
} from "./snapshot";

// create workflow context from snapshot and start running it from the last missing step
export const resumeWorkflowFromHumanResponses = async (
  workflow: Workflow, // the workflow to resume
  humanResponses: Array<HumanResponseEventData>, // human can send multiple responses
  requestId?: string, // TODO: I think it's good if we have requestId inside humanResponses
): Promise<SnapshotWorkflowContext> => {
  if (!requestId) {
    throw new Error("Request id is required to resume the workflow");
  }

  // check workflow is snapshotable
  const snapshotWorkflow = ensureSnapshotWorkflow(workflow);

  const snapshot = await loadSnapshot(requestId);
  if (!snapshot) {
    // if there is no snapshot, we can't resume the workflow
    throw new Error("No snapshot found for request id: " + requestId);
  }

  // resume the workflow from the snapshot with human response
  const context = snapshotWorkflow.resume(humanResponses, snapshot);

  return context;
};

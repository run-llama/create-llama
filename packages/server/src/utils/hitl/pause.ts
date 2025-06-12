import {
  request,
  type WorkflowContext,
  type WorkflowEvent,
} from "@llamaindex/workflow";
import { randomUUID } from "node:crypto";
import type { HumanResponseEventData } from "./events";
import { ensureSnapshotWorkflowContext, saveSnapshot } from "./snapshot";

// pause the workflow and save the snapshot
export const pauseForHumanInput = async (
  context: WorkflowContext,
  responseEvent: WorkflowEvent<HumanResponseEventData>,
  snapshotId: string = randomUUID(), // automatically generate a request id if not provided
) => {
  const snapshotWorkflowContext = ensureSnapshotWorkflowContext(context);
  const { snapshot, sendEvent } = snapshotWorkflowContext;

  // send a request event to save the missing step (`humanResponseEvent`) to the snapshot
  sendEvent(request(responseEvent));

  // get and save snapshot
  const [_, snapshotData] = await snapshot();
  await saveSnapshot(snapshotId, snapshotData);
};

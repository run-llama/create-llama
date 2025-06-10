/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  withSnapshot,
  type Workflow,
  type WorkflowContext,
} from "@llamaindex/workflow";

// @llama-flow doesn't export snapshot types, we need to infer them from the functions
export type SnapshotWorkflow = ReturnType<typeof withSnapshot<Workflow>>;
export type SnapshotWorkflowContext = ReturnType<
  SnapshotWorkflow["createContext"]
>;

export const serializableMemoryMap = new Map<string, any>(); // TODO: save to file

export const saveSnapshot = async (requestId: string, snapshot: any) => {
  serializableMemoryMap.set(requestId, snapshot);
};

export const loadSnapshot = async (
  requestId: string,
): Promise<any | undefined> => {
  return serializableMemoryMap.get(requestId);
};

export function ensureSnapshotWorkflow(workflow: Workflow): SnapshotWorkflow {
  if (!("resume" in workflow)) {
    throw new Error(
      "Workflow is not a snapshot workflow. Please use withSnapshot() to make it snapshotable.",
    );
  }
  return workflow as SnapshotWorkflow;
}

export function ensureSnapshotWorkflowContext(
  context: WorkflowContext,
): SnapshotWorkflowContext {
  if (!("snapshot" in context)) {
    throw new Error(
      "Cannot get snapshot of the workflow. Please use withSnapshot() to make workflow snapshotable.",
    );
  }
  return context as SnapshotWorkflowContext;
}

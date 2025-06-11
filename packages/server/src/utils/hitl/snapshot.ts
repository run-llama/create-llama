import {
  withSnapshot,
  type Workflow,
  type WorkflowContext,
} from "@llamaindex/workflow";
import { promises as fs } from "fs";
import path from "path";

// @llama-flow doesn't export snapshot types, we need to infer them from the functions
export type SnapshotWorkflow = ReturnType<typeof withSnapshot<Workflow>>;
export type SnapshotWorkflowContext = ReturnType<
  SnapshotWorkflow["createContext"]
>;
export type SnapshotData = Awaited<
  ReturnType<SnapshotWorkflowContext["snapshot"]>
>[1];

const SNAPSHOTS_DIR = path.join("output", "snapshots");

// Ensure the checkpoints directory exists
const ensureCheckpointsDir = async () => {
  try {
    await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
  } catch (error) {
    console.error("Failed to create checkpoints directory:", error);
  }
};

export const saveSnapshot = async (
  requestId: string,
  snapshot: SnapshotData,
) => {
  try {
    await ensureCheckpointsDir();
    const filePath = path.join(SNAPSHOTS_DIR, `${requestId}.json`);
    await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
    console.log(`Snapshot saved to: ${filePath}`);
  } catch (error) {
    console.error("Failed to save snapshot:", error);
    throw error;
  }
};

export const loadSnapshot = async (
  requestId: string,
): Promise<SnapshotData | undefined> => {
  try {
    const filePath = path.join(SNAPSHOTS_DIR, `${requestId}.json`);
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined; // File doesn't exist
    }
    console.error("Failed to load snapshot:", error);
    throw error;
  }
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

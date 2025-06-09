/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  withSnapshot,
  workflowEvent,
  type Workflow,
  type WorkflowContext,
} from "@llamaindex/workflow";
import type { Message } from "ai";
import { z } from "zod";

// @llama-flow doesn't export snapshot types, we need to infer them from the functions
export type SnapshotWorkflow = ReturnType<typeof withSnapshot<Workflow>>;
export type SnapshotWorkflowContext = ReturnType<
  SnapshotWorkflow["createContext"]
>;

export const serializableMemoryMap = new Map<string, any>();

export const saveSnapshot = async (requestId: string, snapshot: any) => {
  // TODO: save to file
  serializableMemoryMap.set(requestId, snapshot);
};

export const loadSnapshot = async (
  requestId: string,
): Promise<any | undefined> => {
  return serializableMemoryMap.get(requestId);
};

export type HumanInputEventData = {
  event_type: string; // An identifier for the input component in UI
  data: unknown; // The data to be sent to the input component in UI
};

// humanInputEvent should be triggered when workflow need to request input from user
// when it is emitted, workflow snapshot will be saved and stream will be paused
// then send HumanInputEventData as annotation to UI to render the input form
export const humanInputEvent = workflowEvent<HumanInputEventData>();

// TODO: we can consider sending JSON Schema for the requested information from user
// Then render it as a form in UI with https://github.com/rjsf-team/react-jsonschema-form
// we can call it formInputEvent (same logic as humanInputEvent but useful when requesting multiple inputs)

export type HumanResponseEventData = {
  data: unknown; // The response data from user
};

// When user make a response to the input request, workflow will be re-created from the last snapshot
// and then trigger humanResponseEvent to resume the workflow
export const humanResponseEvent = workflowEvent<HumanResponseEventData>();

export const humanResponseAnnotationSchema = z.object({
  type: z.literal("human_response"),
  data: z.any(),
});

export const getHumanResponseFromMessage = (message: Message) => {
  if (message.annotations) {
    for (const annotation of message.annotations) {
      if (humanResponseAnnotationSchema.safeParse(annotation).success) {
        return (annotation as z.infer<typeof humanResponseAnnotationSchema>)
          .data;
      }
    }
  }
  return null;
};

export const createWorkflowContextFromHumanResponse = async (
  workflow: Workflow,
  requestId: string,
  humanResponse: any,
): Promise<SnapshotWorkflowContext> => {
  // check workflow is snapshotable
  if (!("resume" in workflow)) {
    // TODO: ensure AgentWorkflow is snapshotable
    throw new Error(
      "Workflow is not a snapshot workflow. Please use withSnapshot() to make it snapshotable.",
    );
  }

  // if there is no snapshot, we can't resume the workflow
  const snapshot = await loadSnapshot(requestId);
  if (!snapshot) {
    throw new Error("No snapshot found for request id: " + requestId);
  }

  // resume the workflow from the snapshot with human response
  const context = (workflow as SnapshotWorkflow).resume(
    humanResponse,
    snapshot,
  );

  return context;
};

export const pauseForHumanInput = async (
  context: WorkflowContext,
  requestId: string,
) => {
  if (!("snapshot" in context)) {
    // check workflow is snapshotable
    throw new Error(
      "Cannot get snapshot of the workflow. Please use withSnapshot() to make it snapshotable.",
    );
  }

  // save snapshot with the key is requestId
  const snapshotContext = context as SnapshotWorkflowContext;
  const snapshot = await snapshotContext.snapshot();
  await saveSnapshot(requestId, snapshot);
};

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  request,
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
  type: string; // An identifier for the input component in UI
  data: unknown; // The data to be sent to the input component in UI
};

// humanInputEvent should be triggered when workflow need to request input from user
// when it is emitted, workflow snapshot will be saved and stream will be paused
// then send HumanInputEventData as annotation to UI to render the input form
export const humanInputEvent = workflowEvent<HumanInputEventData>();

// TODO: we can consider sending JSON Schema for the requested information from user
// Then render it as a form in UI with https://github.com/rjsf-team/react-jsonschema-form
// we can call it formInputEvent (same logic as humanInputEvent but useful when requesting multiple inputs)

// When user make a response to the input request, workflow will be re-created from the last snapshot
// and then trigger humanResponseEvent to resume the workflow
export const humanResponseEvent = workflowEvent<unknown>();

// pause the workflow and save the snapshot
export const pauseForHumanInput = async (
  context: WorkflowContext,
  requestId: string,
) => {
  const snapshotWorkflowContext = ensureSnapshotWorkflowContext(context);
  const { snapshot, sendEvent } = snapshotWorkflowContext;

  // send a request event to save the missing step (`humanResponseEvent`) to the snapshot
  sendEvent(request(humanResponseEvent));

  // get and save snapshot
  const [_, snapshotData] = await snapshot();
  await saveSnapshot(requestId, snapshotData);
};

export const humanResponseAnnotationSchema = z.object({
  type: z.literal("human_response"),
  data: z.any(),
});

export type HumanResponseAnnotation = z.infer<
  typeof humanResponseAnnotationSchema
>;

export type HumanResponseData = HumanResponseAnnotation["data"];

// extract a list of human responses from the message annotations
export const getHumanResponsesFromMessage = (
  message: Message,
): Array<HumanResponseData> => {
  return (
    message.annotations
      ?.filter(
        (annotation): annotation is HumanResponseAnnotation =>
          humanResponseAnnotationSchema.safeParse(annotation).success,
      )
      .map((annotation) => annotation.data) ?? []
  );
};

export const resumeWorkflowFromHumanResponses = async (
  workflow: Workflow, // the workflow to resume
  humanResponses: Array<HumanResponseData>, // human can send multiple responses
  requestId: string, // TODO: I think it's good if we have requestId inside humanResponses
): Promise<SnapshotWorkflowContext> => {
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

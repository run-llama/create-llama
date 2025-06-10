import { workflowEvent } from "@llamaindex/workflow";
import type { Message } from "ai";
import { z } from "zod";

export const humanInputEventSchema = z.object({
  type: z.string(), // An identifier for the input component in UI
  data: z.any(), // The data to be sent to the input component in UI
});

export type HumanInputEventData = z.infer<typeof humanInputEventSchema>;

// humanInputEvent should be triggered when workflow need to request input from user
// when it is emitted, workflow snapshot will be saved and stream will be paused
// then send HumanInputEventData as annotation to UI to render the input form
export const humanInputEvent = workflowEvent<HumanInputEventData>();

export const humanResponseEventSchema = z.object({
  type: z.literal("human_response"), // literal type to extract human responses from chat request
  data: z.any(),
});

export type HumanResponseEventData = z.infer<typeof humanResponseEventSchema>;

// When user make a response to the input request, workflow will be re-created from the last snapshot
// and then trigger humanResponseEvent to resume the workflow
export const humanResponseEvent = workflowEvent<HumanResponseEventData>();

// helper function to extract human responses from message annotations
export const getHumanResponsesFromMessage = (
  message: Message,
): Array<HumanResponseEventData> => {
  return (
    message.annotations?.filter(
      (annotation): annotation is HumanResponseEventData =>
        humanResponseEventSchema.safeParse(annotation).success,
    ) ?? []
  );
};

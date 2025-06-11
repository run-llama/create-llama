import { workflowEvent } from "@llamaindex/workflow";
import type { Message } from "ai";
import { z, ZodSchema } from "zod";

export const humanInputEventSchema = z.object({
  type: z.string(), // An identifier for the input component in UI
  data: z.any(), // The data to be sent to the input component in UI
});

export type HumanInputEventData = z.infer<typeof humanInputEventSchema>;

export class HumanInputEvent {
  static event = workflowEvent<HumanInputEventData>();

  static fromSchema = <T extends ZodSchema>(schema: T) => {
    const originalWith = this.event.with;
    return Object.assign(this.event, {
      with: (data: z.infer<T>) => {
        schema.parse(data);
        return originalWith(data);
      },
    }) as Omit<typeof this.event, "with"> & {
      with: (
        data: z.infer<T>,
      ) => Omit<ReturnType<typeof originalWith>, "data"> & { data: z.infer<T> };
    };
  };

  private constructor() {}
}

// humanInputEvent should be triggered when workflow need to request input from user
// when it is emitted, workflow snapshot will be saved and stream will be paused
// then send HumanInputEventData as annotation to UI to render the input form
export const humanInputEvent = HumanInputEvent.event;

export const humanResponseEventSchema = z.object({
  type: z.literal("human_response"), // literal type to extract human responses from chat request
  data: z.any(),
});

export type HumanResponseEventData = z.infer<typeof humanResponseEventSchema>;

export class HumanResponseEvent {
  static event = workflowEvent<HumanResponseEventData>();

  static fromSchema = <T extends ZodSchema>(schema: T) => {
    const originalWith = this.event.with;
    return Object.assign(this.event, {
      with: (data: z.infer<T>) => {
        schema.parse(data);
        return originalWith(data);
      },
    }) as Omit<typeof this.event, "with"> & {
      with: (
        data: z.infer<T>,
      ) => Omit<ReturnType<typeof originalWith>, "data"> & { data: z.infer<T> };
    };
  };

  private constructor() {}
}

// When user make a response to the input request, workflow will be re-created from the last snapshot
// and then trigger humanResponseEvent to resume the workflow
export const humanResponseEvent = HumanResponseEvent.event;

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

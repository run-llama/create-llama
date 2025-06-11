import { HumanInputEvent, HumanResponseEvent } from "@llamaindex/server";
import z from "zod";

export const cliHumanInputEvent = HumanInputEvent.fromSchema(
  z.object({
    type: z.literal("cli_human_input"),
    data: z.object({
      command: z.string(),
    }),
  }),
);

export const cliHumanResponseEvent = HumanResponseEvent.fromSchema(
  z.object({
    type: z.literal("human_response"),
    data: z.object({
      execute: z.boolean(),
      command: z.string(),
    }),
  }),
);

import { humanInputEvent, humanResponseEvent } from "@llamaindex/server";

export const cliHumanInputEvent = humanInputEvent<{
  type: "cli_human_input";
  data: { command: string };
  response: typeof cliHumanResponseEvent;
}>();

export const cliHumanResponseEvent = humanResponseEvent<{
  type: "human_response";
  data: { execute: boolean; command: string };
}>();

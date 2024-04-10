import { JSONValue, Message } from "ai";

export const isValidMessageData = (rawData: JSONValue | undefined) => {
  if (!rawData || typeof rawData !== "object") return false;
  if (Object.keys(rawData).length === 0) return false;
  return true;
};

export const insertDataIntoMessages = (
  messages: Message[],
  data: JSONValue[] | undefined,
) => {
  if (!data) return messages;
  messages.forEach((message, i) => {
    const rawData = data[i];
    if (isValidMessageData(rawData)) message.data = rawData;
  });
  return messages;
};

interface NonStreamingResponseMessage {
  result: {
    role: string;
    content: string;
  };
  nodes: {
    id: string;
    medadata: Record<string, unknown>;
    score: number;
    text: string;
  }[];
}

export const transformNonStreamingMessages = (messages: Message[]) => {
  const SCORE_THRESHOLD = 0.5;
  messages.forEach((message) => {
    if (message.role === "assistant") {
      try {
        const response = JSON.parse(
          message.content,
        ) as NonStreamingResponseMessage;
        message.content = response.result.content;
        (message as any).nodes = response.nodes
          .filter((node) => node.score > SCORE_THRESHOLD)
          .sort((a, b) => b.score - a.score);
      } catch (error) {}
    }
  });
  return messages;
};

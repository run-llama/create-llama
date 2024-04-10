import { JSONValue, Message } from "ai";

export const isValidMessageData = (rawData: JSONValue | undefined) => {
  if (!rawData || typeof rawData !== "object") return false;
  if (Object.keys(rawData).length === 0) return false;
  return true;
};

const transformNodes = (nodes: any) => {
  const SCORE_THRESHOLD = 0.5;
  return nodes
    .filter((node: any) => node.score > SCORE_THRESHOLD)
    .sort((a: any, b: any) => b.score - a.score);
};

export const insertDataIntoMessages = (
  messages: Message[],
  data: JSONValue[] | undefined,
) => {
  if (!data) return messages;
  messages.forEach((message, i) => {
    const rawData = data[i];
    if (isValidMessageData(rawData)) {
      // If the message has nodes, transform them
      if ((rawData as any).nodes?.length) {
        message.data = {
          nodes: transformNodes((rawData as any)?.nodes),
        };
      } else {
        message.data = rawData;
      }
    }
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
  messages.forEach((message) => {
    if (message.role === "assistant") {
      try {
        const response = JSON.parse(
          message.content,
        ) as NonStreamingResponseMessage;
        message.content = response.result.content;
        (message as any).data = {
          nodes: transformNodes(response.nodes),
        };
      } catch (error) {}
    }
  });
  return messages;
};

import { extractFileAttachments, getStoredFilePath } from "@llamaindex/server";
import { agent } from "@llamaindex/workflow";
import { type Message } from "ai";
import { tool } from "llamaindex";
import { promises as fsPromises } from "node:fs";
import { z } from "zod";

export const workflowFactory = async (reqBody: { messages: Message[] }) => {
  const { messages } = reqBody;
  // Extract the files from the messages
  const files = extractFileAttachments(messages);
  const fileIds = files.map((file) => file.id);

  // Define a tool to read the file content using the id
  const readFileTool = tool(
    ({ fileId }) => {
      if (!fileIds.includes(fileId)) {
        throw new Error(`File with id ${fileId} not found`);
      }

      const filePath = getStoredFilePath({ id: fileId });
      return fsPromises.readFile(filePath, "utf8");
    },
    {
      name: "read_file",
      description: `Use this tool with the id of the file to read the file content. Here are the available file ids: [${fileIds.join(", ")}]`,
      parameters: z.object({
        fileId: z.string(),
      }),
    },
  );
  return agent({
    tools: [readFileTool],
    systemPrompt: `
      You are a helpful assistant that can help the user with their file.
      You can use the read_file tool to read the file content.
    `,
  });
};

import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import {
  extractFileAttachments,
  getStoredFilePath,
  LlamaIndexServer,
} from "@llamaindex/server";
import { agent } from "@llamaindex/workflow";
import { type Message } from "ai";
import { Settings, tool } from "llamaindex";
import { promises as fsPromises } from "node:fs";
import { z } from "zod";

Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
});

Settings.embedModel = new OpenAIEmbedding({
  model: "text-embedding-3-small",
});

export const workflowFactory = async (reqBody: { messages: Message[] }) => {
  const { messages } = reqBody;
  // Extract the files from the messages
  const files = extractFileAttachments(messages);

  // Define a tool to read the file content using the id
  const readFileTool = tool(
    ({ id }) => {
      const filePath = getStoredFilePath({ id });
      return fsPromises.readFile(filePath, "utf8");
    },
    {
      name: "read_file",
      description: `
        Use this tool with the id of the file to read the file content. 
        The available files are: ${files.map((file) => file.id).join(", ")}`,
      parameters: z.object({
        id: z.string(),
      }),
    },
  );
  return agent({ tools: [readFileTool] });
};

new LlamaIndexServer({
  workflow: workflowFactory,
  suggestNextQuestions: true,
  uiConfig: {
    enableFileUpload: true,
  },
  port: 3000,
}).start();

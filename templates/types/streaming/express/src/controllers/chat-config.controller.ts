import { Request, Response } from "express";
import { LLamaCloudFileService } from "./llamaindex/streaming/service";

export const chatConfig = async (_req: Request, res: Response) => {
  let starterQuestions = undefined;
  if (
    process.env.CONVERSATION_STARTERS &&
    process.env.CONVERSATION_STARTERS.trim()
  ) {
    starterQuestions = process.env.CONVERSATION_STARTERS.trim().split("\n");
  }
  return res.status(200).json({
    starterQuestions,
  });
};

export const chatLlamaCloudConfig = async (_req: Request, res: Response) => {
  const config = {
    projects: await LLamaCloudFileService.getAllProjectsWithPipelines(),
    pipeline: {
      pipeline: process.env.LLAMA_CLOUD_INDEX_NAME,
      project: process.env.LLAMA_CLOUD_PROJECT_NAME,
    },
  };
  return res.status(200).json(config);
};

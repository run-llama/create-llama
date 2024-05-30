import { Request, Response } from "express";

export const chatConfig = async (_req: Request, res: Response) => {
  const config = {
    starterQuestions: process.env.CONVERSATION_STARTERS?.trim().split("\n"),
  };
  return res.status(200).json(config);
};

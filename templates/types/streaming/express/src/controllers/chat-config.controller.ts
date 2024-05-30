import { Request, Response } from "express";

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

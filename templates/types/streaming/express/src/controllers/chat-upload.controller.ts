import { Request, Response } from "express";
import { uploadDocument } from "./llamaindex/documents/documents";

export const chatUpload = async (req: Request, res: Response) => {
  const { base64 }: { base64: string } = req.body;
  if (!base64) {
    return res.status(400).json({
      error: "base64 is required in the request body",
    });
  }
  return res.status(200).json(await uploadDocument(base64));
};

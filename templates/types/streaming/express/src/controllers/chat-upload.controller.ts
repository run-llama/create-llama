import { Request, Response } from "express";
import { getDataSource } from "./engine";
import { uploadDocument } from "./llamaindex/documents/upload";

export const chatUpload = async (req: Request, res: Response) => {
  const { base64, params }: { base64: string; params?: any } = req.body;
  if (!base64) {
    return res.status(400).json({
      error: "base64 is required in the request body",
    });
  }
  const index = await getDataSource(params);
  return res.status(200).json(await uploadDocument(index, base64));
};

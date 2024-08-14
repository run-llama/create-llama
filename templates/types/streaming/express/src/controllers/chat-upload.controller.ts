import { Request, Response } from "express";
import { getDataSource } from "./engine";
import { uploadDocument } from "./llamaindex/documents/upload";

export const chatUpload = async (req: Request, res: Response) => {
  const {
    filename,
    base64,
    params,
  }: { filename: string; base64: string; params?: any } = req.body;
  if (!base64 || !filename) {
    return res.status(400).json({
      error: "base64 and filename is required in the request body",
    });
  }
  const index = await getDataSource(params);
  return res.status(200).json(await uploadDocument(index, filename, base64));
};

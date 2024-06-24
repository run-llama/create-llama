"use client";

import { useState } from "react";
import { PdfFile } from "..";
import { useClientConfig } from "./use-config";

export function usePdf() {
  const { embedAPI } = useClientConfig();
  const [pdf, setPdf] = useState<PdfFile | null>(null);

  const getPdfDetail = async (
    pdfBase64: string,
  ): Promise<Pick<PdfFile, "content" | "embeddings">> => {
    if (!embedAPI) throw new Error("Embed API is not defined");
    const response = await fetch(embedAPI, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pdf: pdfBase64,
      }),
    });
    if (!response.ok) throw new Error("Failed to get pdf detail");
    const data = await response.json();
    return data;
  };

  const uploadAndEmbed = async (pdf: {
    id: string;
    filename: string;
    filesize: number;
    pdfBase64: string;
  }) => {
    const { pdfBase64, ...rest } = pdf;
    const pdfDetail = await getPdfDetail(pdfBase64);
    setPdf({ ...pdfDetail, ...rest });
    return pdfDetail;
  };

  return { pdf, setPdf, uploadAndEmbed };
}

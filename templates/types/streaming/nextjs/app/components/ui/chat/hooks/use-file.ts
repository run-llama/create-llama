"use client";

import { JSONValue } from "llamaindex";
import { useState } from "react";
import { ContentFile, MessageAnnotation, MessageAnnotationType } from "..";
import { useClientConfig } from "./use-config";

export function useFile() {
  const { embedAPI } = useClientConfig();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [files, setFiles] = useState<ContentFile[]>([]);

  const fileEqual = (a: ContentFile, b: ContentFile) => {
    if (a.id === b.id) return true;
    if (a.filename === b.filename && a.filesize === b.filesize) return true;
    return false;
  };

  const upload = (file: ContentFile) => {
    const existedFile = files.find((f) => fileEqual(f, file));
    if (!existedFile) {
      setFiles((prev) => [...prev, file]);
      return true;
    }
    return false;
  };

  const remove = (file: ContentFile) => {
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
  };

  const reset = () => {
    imageUrl && setImageUrl(null);
    files.length && setFiles([]);
  };

  const getPdfDetail = async (
    pdfBase64: string,
  ): Promise<Pick<ContentFile, "content" | "embeddings">> => {
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

  const uploadPdf = async (pdf: {
    id: string;
    filename: string;
    filesize: number;
    pdfBase64: string;
  }) => {
    const { pdfBase64, ...rest } = pdf;
    const pdfDetail = await getPdfDetail(pdfBase64);
    return upload({
      filetype: "pdf",
      ...rest,
      ...pdfDetail,
    });
  };

  const getAnnotations = () => {
    const annotations: MessageAnnotation[] = [];
    if (imageUrl) {
      annotations.push({
        type: MessageAnnotationType.IMAGE,
        data: { url: imageUrl },
      });
    }
    if (files.length > 0) {
      annotations.push({
        type: MessageAnnotationType.CONTENT_FILE,
        data: { files },
      });
    }
    return annotations as JSONValue[];
  };

  const alreadyUploaded = imageUrl || files.length > 0;

  return {
    files,
    upload,
    remove,
    reset,
    uploadPdf,
    imageUrl,
    setImageUrl,
    getAnnotations,
    alreadyUploaded,
  };
}

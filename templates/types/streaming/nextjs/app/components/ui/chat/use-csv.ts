"use client";

import { useState } from "react";
import { CsvFile } from ".";

export function useCsv() {
  const [uploadedFiles, setUploadedFiles] = useState<CsvFile[]>([]);

  const csvEqual = (a: CsvFile, b: CsvFile) => {
    if (a.id === b.id) return true;
    if (a.filename === b.filename && a.filesize === b.filesize) return true;
    return false;
  };

  const uploadNew = (file: CsvFile) => {
    const existedCsv = uploadedFiles.find((f) => csvEqual(f, file));
    if (!existedCsv) {
      setUploadedFiles((prev) => [...prev, file]);
      return true;
    }
    return false;
  };

  const removeFile = (file: CsvFile) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== file.id));
  };

  const resetUploadedFiles = () => {
    setUploadedFiles([]);
  };

  return {
    uploadedFiles,
    uploadNew,
    removeFile,
    resetUploadedFiles,
  };
}

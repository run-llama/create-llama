"use client";

import { Message } from "ai";
import { useEffect, useMemo, useState } from "react";
import {
  CsvData,
  CsvFile,
  MessageAnnotation,
  MessageAnnotationType,
  getAnnotationData,
} from ".";

interface FrontendCSVData extends CsvFile {
  type: "available" | "new_upload";
}

export function useCsv(messages: Message[]) {
  const [availableFiles, setAvailableFiles] = useState<FrontendCSVData[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<FrontendCSVData[]>([]);

  const files = useMemo(() => {
    return [...availableFiles, ...uploadedFiles];
  }, [availableFiles, uploadedFiles]);

  useEffect(() => {
    const items = getAvailableCsvFiles(messages);
    setAvailableFiles(items.map((data) => ({ ...data, type: "available" })));
  }, [messages]);

  const csvEqual = (a: CsvFile, b: CsvFile) => {
    if (a.id === b.id) return true;
    if (a.filename === b.filename && a.filesize === b.filesize) return true;
    return false;
  };

  // Get available csv files from annotations chat history
  // returns the unique csv files by id
  const getAvailableCsvFiles = (messages: Message[]): Array<CsvFile> => {
    const docHash: Record<string, CsvFile> = {};
    messages.forEach((message) => {
      if (message.annotations) {
        const csvData = getAnnotationData<CsvData>(
          message.annotations as MessageAnnotation[],
          MessageAnnotationType.CSV,
        );
        csvData.forEach((data) => {
          data.csvFiles.forEach((file) => {
            if (!docHash[file.id]) {
              docHash[file.id] = file;
            }
          });
        });
      }
    });
    return Object.values(docHash);
  };

  const uploadNew = (file: CsvFile) => {
    const existedCsv = files.find((f) => csvEqual(f, file));
    if (!existedCsv) {
      setUploadedFiles((prev) => [...prev, { ...file, type: "new_upload" }]);
      return true;
    }
    return false;
  };

  const removeFile = (file: FrontendCSVData) => {
    if (file.type === "new_upload") {
      setUploadedFiles((prev) => prev.filter((f) => f.id !== file.id));
    } else {
      setAvailableFiles((prev) => prev.filter((f) => f.id !== file.id));
    }
  };

  const resetUploadedFiles = () => {
    setUploadedFiles([]);
  };

  return {
    files,
    uploadNew,
    removeFile,
    resetUploadedFiles,
  };
}

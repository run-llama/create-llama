import { PDFViewer, PdfFocusProvider } from "@llamaindex/pdf-viewer";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../../drawer";

export interface PdfDialogProps {
  documentId: string;
  url: string;
  trigger: React.ReactNode;
}

enum FileStatus {
  LOADING = "loading",
  ERROR = "error",
  READY = "ready",
}

export default function PdfDialog(props: PdfDialogProps) {
  const [fileStatus, setFileStatus] = useState<FileStatus>(FileStatus.LOADING);

  useEffect(() => {
    const checkFile = async () => {
      try {
        await fetch(props.url, { method: "HEAD" });
        setFileStatus(FileStatus.READY);
      } catch (error) {
        setFileStatus(FileStatus.ERROR);
      }
    };
    checkFile();
  }, [props.url]);

  return (
    <Drawer direction="left">
      <DrawerTrigger>{props.trigger}</DrawerTrigger>
      <DrawerContent className="w-3/5 mt-24 h-full max-h-[96%] ">
        <DrawerHeader className="flex justify-between">
          <div className="space-y-2">
            <DrawerTitle>PDF Content</DrawerTitle>
            <DrawerDescription className="flex gap-2 items-center">
              <span>File URL:</span>
              <a
                className="hover:text-blue-900 max-w-xs block truncate"
                href={props.url}
                target="_blank"
              >
                {props.url}
              </a>
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="m-4">
          {fileStatus === FileStatus.LOADING && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {fileStatus === FileStatus.ERROR && (
            <div className="">
              Failed to load content of PDF file. The reason could be that the
              file is blocked due to the external file server CORS policy, the
              file URL has expired, or the file no longer exists. <br /> <br />
              Please try opening the file in{" "}
              <a
                target="_blank"
                href={props.url}
                className="underline text-blue-900"
              >
                your browser
              </a>
            </div>
          )}
          {fileStatus === FileStatus.READY && (
            <PdfFocusProvider>
              <PDFViewer
                file={{
                  id: props.documentId,
                  url: props.url,
                }}
              />
            </PdfFocusProvider>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

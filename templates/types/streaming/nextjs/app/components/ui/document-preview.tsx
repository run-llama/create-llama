import { XCircleIcon } from "lucide-react";
import Image from "next/image";
import DocxIcon from "../ui/icons/docx.svg";
import PdfIcon from "../ui/icons/pdf.svg";
import SheetIcon from "../ui/icons/sheet.svg";
import TxtIcon from "../ui/icons/txt.svg";
import { Button } from "./button";
import { DocumentFile, DocumentFileType } from "./chat";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer";
import { cn } from "./lib/utils";

export interface DocumentPreviewProps {
  file: DocumentFile;
  onRemove?: () => void;
}

export function DocumentPreview(props: DocumentPreviewProps) {
  const { filename, filesize, content, filetype } = props.file;

  if (content.type === "ref") {
    return (
      <div title={`Document IDs: ${(content.value as string[]).join(", ")}`}>
        <PreviewCard {...props} />
      </div>
    );
  }

  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        <div>
          <PreviewCard {...props} />
        </div>
      </DrawerTrigger>
      <DrawerContent className="w-3/5 mt-24 h-full max-h-[96%] ">
        <DrawerHeader className="flex justify-between">
          <div className="space-y-2">
            <DrawerTitle>{filetype.toUpperCase()} Raw Content</DrawerTitle>
            <DrawerDescription>
              {filename} ({inKB(filesize)} KB)
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="m-4 max-h-[80%] overflow-auto">
          {content.type === "text" && (
            <pre className="bg-secondary rounded-md p-4 block text-sm">
              {content.value as string}
            </pre>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export const FileIcon: Record<DocumentFileType, string> = {
  csv: SheetIcon,
  pdf: PdfIcon,
  docx: DocxIcon,
  txt: TxtIcon,
};

function PreviewCard(props: DocumentPreviewProps) {
  const { onRemove, file } = props;
  return (
    <div
      className={cn(
        "p-2 w-60 max-w-60 bg-secondary rounded-lg text-sm relative",
        file.content.type === "ref" ? "" : "cursor-pointer",
      )}
    >
      <div className="flex flex-row items-center gap-2">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md">
          <Image
            className="h-full w-auto"
            priority
            src={FileIcon[file.filetype]}
            alt="Icon"
          />
        </div>
        <div className="overflow-hidden">
          <div className="truncate font-semibold">
            {file.filename} ({inKB(file.filesize)} KB)
          </div>
          <div className="truncate text-token-text-tertiary flex items-center gap-2">
            <span>{file.filetype.toUpperCase()} File</span>
          </div>
        </div>
      </div>
      {onRemove && (
        <div
          className={cn(
            "absolute -top-2 -right-2 w-6 h-6 z-10 bg-gray-500 text-white rounded-full",
          )}
        >
          <XCircleIcon
            className="w-6 h-6 bg-gray-500 text-white rounded-full"
            onClick={onRemove}
          />
        </div>
      )}
    </div>
  );
}

function inKB(size: number) {
  return Math.round((size / 1024) * 10) / 10;
}

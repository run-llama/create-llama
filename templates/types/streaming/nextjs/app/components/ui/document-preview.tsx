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
  const { name, size, type, refs } = props.file;

  if (refs?.length) {
    return (
      <div title={`Document IDs: ${refs.join(", ")}`}>
        <PreviewCard {...props} />
      </div>
    );
  }

  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        <div>
          <PreviewCard className="cursor-pointer" {...props} />
        </div>
      </DrawerTrigger>
      <DrawerContent className="w-3/5 mt-24 h-full max-h-[96%] ">
        <DrawerHeader className="flex justify-between">
          <div className="space-y-2">
            <DrawerTitle>{type.toUpperCase()} Raw Content</DrawerTitle>
            <DrawerDescription>
              {name} ({inKB(size)} KB)
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="m-4 max-h-[80%] overflow-auto">
          {refs?.length && (
            <pre className="bg-secondary rounded-md p-4 block text-sm">
              {refs.join(", ")}
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

export function PreviewCard(props: {
  file: {
    name: string;
    size?: number;
    type: DocumentFileType;
  };
  onRemove?: () => void;
  className?: string;
}) {
  const { onRemove, file, className } = props;
  return (
    <div
      className={cn(
        "p-2 w-60 max-w-60 bg-secondary rounded-lg text-sm relative",
        className,
      )}
    >
      <div className="flex flex-row items-center gap-2">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md flex items-center justify-center">
          <Image
            className="h-full w-auto object-contain"
            priority
            src={FileIcon[file.type]}
            alt="Icon"
          />
        </div>
        <div className="overflow-hidden">
          <div className="truncate font-semibold">
            {file.name} {file.size ? `(${inKB(file.size)} KB)` : ""}
          </div>
          {file.type && (
            <div className="truncate text-token-text-tertiary flex items-center gap-2">
              <span>{file.type.toUpperCase()} File</span>
            </div>
          )}
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

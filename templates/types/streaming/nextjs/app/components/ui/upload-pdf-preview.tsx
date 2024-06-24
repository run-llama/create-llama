import { FileText, XCircleIcon } from "lucide-react";
import { Button } from "./button";
import { PdfFile } from "./chat";
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

export interface UploadPdfPreviewProps {
  pdf: PdfFile;
  onRemove?: () => void;
}

export default function UploadPdfPreview(props: UploadPdfPreviewProps) {
  const { filename, filesize, content } = props.pdf;

  // TODO: replace by PdfDialog later when we save PDF file in backend
  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        <div>
          <PDFSummaryCard {...props} />
        </div>
      </DrawerTrigger>
      <DrawerContent className="w-3/5 mt-24 h-full max-h-[96%] ">
        <DrawerHeader className="flex justify-between">
          <div className="space-y-2">
            <DrawerTitle>Pdf Raw Content</DrawerTitle>
            <DrawerDescription>
              {filename} ({inKB(filesize)} KB)
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="m-4 max-h-[80%] overflow-auto">
          <pre className="bg-secondary rounded-md p-4 block text-sm">
            {content}
          </pre>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function PDFSummaryCard(props: UploadPdfPreviewProps) {
  const { onRemove, pdf } = props;
  return (
    <div className="p-2 w-60 max-w-60 bg-secondary rounded-lg text-sm relative cursor-pointer">
      <div className="flex flex-row items-center gap-2">
        <FileText className="w-6 h-6 text-red-500" />
        <div className="overflow-hidden">
          <div className="truncate font-semibold">
            {pdf.filename} ({inKB(pdf.filesize)} KB)
          </div>
          <div className="truncate text-token-text-tertiary flex items-center gap-2">
            <span>PDF File</span>
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

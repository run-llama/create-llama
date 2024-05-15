import { PDFViewer, PdfFocusProvider } from "@llamaindex/pdf-viewer";
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
import { getFileDataUrl } from "../../lib/url";

export interface PdfDialogProps {
  documentId: string;
  filePath: string;
  trigger: React.ReactNode;
}

export default function PdfDialog(props: PdfDialogProps) {
  return (
    <Drawer direction="left">
      <DrawerTrigger>{props.trigger}</DrawerTrigger>
      <DrawerContent className="w-3/5 mt-24 h-full max-h-[96%] ">
        <DrawerHeader className="flex justify-between">
          <div className="space-y-2">
            <DrawerTitle>PDF Content</DrawerTitle>
            <DrawerDescription>File path: {props.filePath}</DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="m-4">
          <PdfFocusProvider>
            <PDFViewer
              file={{
                id: props.documentId,
                url: getFileDataUrl(props.filePath),
              }}
            />
          </PdfFocusProvider>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

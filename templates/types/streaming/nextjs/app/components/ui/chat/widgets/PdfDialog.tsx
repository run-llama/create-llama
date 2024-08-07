import dynamic from "next/dynamic";
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

// Dynamic imports for client-side rendering only
const PDFViewer = dynamic(
  () => import("@llamaindex/pdf-viewer").then((module) => module.PDFViewer),
  { ssr: false },
);

const PdfFocusProvider = dynamic(
  () =>
    import("@llamaindex/pdf-viewer").then((module) => module.PdfFocusProvider),
  { ssr: false },
);

export default function PdfDialog(props: PdfDialogProps) {
  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>{props.trigger}</DrawerTrigger>
      <DrawerContent className="w-3/5 mt-24 h-full max-h-[96%] ">
        <DrawerHeader className="flex justify-between">
          <div className="space-y-2">
            <DrawerTitle>PDF Content</DrawerTitle>
            <DrawerDescription>
              File URL:{" "}
              <a
                className="hover:text-blue-900"
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
          <PdfFocusProvider>
            <PDFViewer
              file={{
                id: props.documentId,
                url: props.url,
              }}
            />
          </PdfFocusProvider>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

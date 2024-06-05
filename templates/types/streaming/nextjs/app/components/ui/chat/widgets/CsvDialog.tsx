import Image from "next/image";
import { CsvFile } from "..";
import SheetIcon from "../../../ui/icons/sheet.svg";
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

export interface CsvDialogProps {
  csv: CsvFile;
  trigger?: JSX.Element;
}

export default function CsvDialog(props: CsvDialogProps) {
  const { filename, filesize, content } = props.csv;
  const fileSizeInKB = Math.round((filesize / 1024) * 10) / 10;
  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        {props.trigger ? (
          <div className="cursor-pointer">{props.trigger}</div>
        ) : (
          <div
            className="border-2 border-green-700 py-1.5 px-3 rounded-lg flex gap-2 items-center cursor-pointer text-sm hover:bg-green-700 hover:text-white transition-colors duration-200 ease-in-out"
            key={filename}
          >
            <div className="h-4 w-4 shrink-0 rounded-md">
              <Image
                className="h-full w-auto"
                priority
                src={SheetIcon}
                alt="SheetIcon"
              />
            </div>
            <span>
              {filename} - {fileSizeInKB} KB
            </span>
          </div>
        )}
      </DrawerTrigger>
      <DrawerContent className="w-3/5 mt-24 h-full max-h-[96%] ">
        <DrawerHeader className="flex justify-between">
          <div className="space-y-2">
            <DrawerTitle>Csv Raw Content</DrawerTitle>
            <DrawerDescription>
              {filename} ({fileSizeInKB} KB)
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

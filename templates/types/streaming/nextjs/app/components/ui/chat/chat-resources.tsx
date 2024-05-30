import { Loader2, XIcon } from "lucide-react";
import Image from "next/image";
import { CsvData } from ".";
import SheetIcon from "../../ui/icons/sheet.svg";

export interface ChatResourcesProps {
  isLoading: boolean;
  resources: Array<CsvData & { selected: boolean }>;
  removeResource: (index: number) => void;
}

export default function ChatResources(props: ChatResourcesProps) {
  if (!props.resources.length) return null;
  return (
    <div className="flex gap-4 text-sm">
      {props.resources.map((data, index) => {
        if (!data.selected) return null;
        const fileSizeInKB = Math.round((data.filesize / 1024) * 10) / 10;
        return (
          <div
            className="border-2 border-green-700 py-2 px-3 rounded-lg flex gap-2 items-center"
            key={data.filename}
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
              {data.filename} - {fileSizeInKB} KB
            </span>
            {props.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XIcon
                className="w-4 h-4 cursor-pointer"
                onClick={() => props.removeResource(index)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

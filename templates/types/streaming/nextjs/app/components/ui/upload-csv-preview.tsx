import { XCircleIcon } from "lucide-react";
import Image from "next/image";
import SheetIcon from "../ui/icons/sheet.svg";
import { cn } from "./lib/utils";

export default function UploadCsvPreview({
  filename,
  filesize,
  onRemove,
}: {
  filename: string;
  filesize: number;
  onRemove: () => void;
}) {
  const fileSizeInKB = Math.round((filesize / 1024) * 10) / 10;
  return (
    <div className="p-2 w-80 bg-secondary rounded-lg text-sm relative">
      <div className="flex flex-row items-center gap-2">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md">
          <Image className="h-full w-auto" priority src={SheetIcon} alt="SheetIcon" />
        </div>
        <div className="overflow-hidden">
          <div className="truncate font-semibold">
            {filename} ({fileSizeInKB} KB)
          </div>
          <div className="truncate text-token-text-tertiary">Spreadsheet</div>
        </div>
      </div>
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
    </div>
  );
}

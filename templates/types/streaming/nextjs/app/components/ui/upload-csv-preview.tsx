import { XCircleIcon } from "lucide-react";
import { cn } from "./lib/utils";

function SheetIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 36 36"
      fill="none"
      className="h-10 w-10 flex-shrink-0"
      width="36"
      height="36"
    >
      <rect width="36" height="36" rx="6" fill="#10A37F"></rect>
      <path
        d="M15.5 10.5H12.1667C11.2462 10.5 10.5 11.2462 10.5 12.1667V13.5V18M15.5 10.5H23.8333C24.7538 10.5 25.5 11.2462 25.5 12.1667V13.5V18M15.5 10.5V25.5M15.5 25.5H18H23.8333C24.7538 25.5 25.5 24.7538 25.5 23.8333V18M15.5 25.5H12.1667C11.2462 25.5 10.5 24.7538 10.5 23.8333V18M10.5 18H25.5"
        stroke="white"
        strokeWidth="1.66667"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>
    </svg>
  );
}

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
          <SheetIcon />
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

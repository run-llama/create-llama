import { DocumentPreview } from "../../document-preview";
import { DocumentFileData } from "../index";

export function ChatFiles({ data }: { data: DocumentFileData }) {
  if (!data.files.length) return null;
  return (
    <div className="flex gap-2 items-center">
      {data.files.map((file, index) => (
        <DocumentPreview
          key={file.metadata?.id ?? `${file.filename}-${index}`}
          file={file}
        />
      ))}
    </div>
  );
}

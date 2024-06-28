import { DocumentPreview } from "../../document-preview";
import { DocumentFileData } from "../index";

export function ChatFiles({ data }: { data: DocumentFileData }) {
  if (!data.files.length) return null;
  return (
    <div className="flex gap-2 items-center">
      {data.files.map((file) => (
        <DocumentPreview key={file.id} file={file} />
      ))}
    </div>
  );
}

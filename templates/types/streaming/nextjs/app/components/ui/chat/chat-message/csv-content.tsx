import UploadCsvPreview from "../../upload-csv-preview";
import { CsvData } from "../index";

export default function CsvContent({ data }: { data: CsvData }) {
  if (!data.csvFiles.length) return null;
  return (
    <div className="flex gap-2 items-center">
      {data.csvFiles.map((csv, index) => (
        <UploadCsvPreview key={index} csv={csv} />
      ))}
    </div>
  );
}

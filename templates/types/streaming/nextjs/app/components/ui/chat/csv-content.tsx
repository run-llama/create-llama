import { CsvData } from ".";
import CsvDialog from "./widgets/CsvDialog";

export default function CsvContent({ data }: { data: CsvData }) {
  if (!data.csvFiles.length) return null;
  return (
    <div className="flex gap-2 items-center">
      {data.csvFiles.map((csv, index) => (
        <CsvDialog key={index} csv={csv} />
      ))}
    </div>
  );
}

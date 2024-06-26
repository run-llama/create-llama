import { CsvPreview, PdfPreview } from "../../file-content-preview";
import { CsvData, PDFData } from "../index";

export function CsvFileContent({ data }: { data: CsvData }) {
  if (!data.csvFiles.length) return null;
  return (
    <div className="flex gap-2 items-center">
      {data.csvFiles.map((csv) => (
        <CsvPreview key={csv.id} file={csv} />
      ))}
    </div>
  );
}

export function PdfFileContent({ data }: { data: PDFData }) {
  if (!data.pdfFiles.length) return null;
  return (
    <div className="flex gap-2 items-center">
      {data.pdfFiles.map((pdf) => (
        <PdfPreview key={pdf.id} file={pdf} />
      ))}
    </div>
  );
}

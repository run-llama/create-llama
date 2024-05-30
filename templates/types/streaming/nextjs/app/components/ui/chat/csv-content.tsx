import { CsvData } from ".";

const LIMIT_DISPLAY = 100; // Limit the display of CSV content to 100 characters

export default function CsvContent({ data }: { data: CsvData }) {
  const summaryContent = data.content.slice(0, LIMIT_DISPLAY) + "...";
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">CSV Raw Content</h3>
      <pre className="bg-secondary max-h-[200px] overflow-auto rounded-md p-4 block text-sm">
        {summaryContent}
      </pre>
    </div>
  );
}

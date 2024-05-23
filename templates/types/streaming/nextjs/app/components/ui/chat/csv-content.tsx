import { CsvData } from ".";

export default function CsvContent({ data }: { data: CsvData }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">CSV Raw Content</h3>
      <pre className="bg-secondary max-h-[200px] overflow-auto rounded-md p-4 block text-sm">
        {data.content}
      </pre>
    </div>
  );
}

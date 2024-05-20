import { getStaticFileDataUrl } from "../../lib/url";

export interface InterpreterData {
  isError: boolean;
  extraResult: Array<{
    type: string;
    url: string;
    filename: string;
  }>;
  logs: {
    stderr: string[];
    stdout: string[];
  };
}

export function InterpreterCard({ data }: { data: InterpreterData }) {
  const { isError, extraResult } = data;
  if (isError || !extraResult.length) return null;
  return (
    <div className="space-x-2">
      <span className="font-semibold">Output Files:</span>
      {extraResult.map((result, i) => (
        <a
          className="hover:underline text-blue-500 uppercase"
          href={getStaticFileDataUrl(result.filename)}
          key={i}
          target="_blank"
        >
          {result.type} file
        </a>
      ))}
    </div>
  );
}

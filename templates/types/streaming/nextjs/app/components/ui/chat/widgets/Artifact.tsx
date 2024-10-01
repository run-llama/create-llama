import { Code, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "../../button";
import { cn } from "../../lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../tabs";
import Markdown from "../chat-message/markdown";

// detail information to execute code
export type CodeArtifact = {
  commentary: string;
  template: string;
  title: string;
  description: string;
  additional_dependencies: string[];
  has_additional_dependencies: boolean;
  install_dependencies_command: string;
  port: number | null;
  file_path: string;
  code: string;
};

type ArtifactResult = {
  template: string;
  stdout: string[];
  stderr: string[];
  runtimeError?: { name: string; value: string; tracebackRaw: string[] };
  outputUrls: Array<{ url: string; filename: string }>;
  url: string;
};

export function Artifact({
  artifact,
  version,
}: {
  artifact: CodeArtifact | null;
  version?: number;
}) {
  const [result, setResult] = useState<ArtifactResult | null>(null);
  const [openOutputPanel, setOpenOutputPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!result) {
      fetchArtifactResult();
    }
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!artifact || version === undefined) return null;

  // this is just a hack to handle the layout when opening the output panel
  // for real world application, you should use a global state management to control layout
  const handleDOMLayout = () => {
    // hide all current artifact panel
    const artifactPanels = document.querySelectorAll(".artifact-panel");
    artifactPanels.forEach((panel) => {
      panel.classList.add("hidden");
    });

    // make the main div width smaller to have space for the output panel
    const mainDiv = document.querySelector("main");
    mainDiv?.classList.remove("w-screen");
    mainDiv?.classList.add("w-[55vw]");
    mainDiv?.classList.add("px-8");

    // show the current artifact panel
    panelRef.current?.classList.remove("hidden");
  };

  const handleOpenOutput = () => {
    setOpenOutputPanel(true);
    handleDOMLayout();
  };

  const fetchArtifactResult = async () => {
    try {
      const response = await fetch("/api/sandbox", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ artifact }),
      });

      if (!response.ok) {
        throw new Error("Failure running code artifact");
      }

      const fetchedResult = await response.json();
      console.log("result", fetchedResult);

      setResult(fetchedResult);
    } catch (error) {
      console.error("Error fetching artifact result:", error);
      // Handle error (e.g., show error message to user)
    }
  };

  return (
    <div>
      <div
        onClick={handleOpenOutput}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-auto cursor-pointer px-6 py-3 w-full flex gap-4 items-center justify-start border border-gray-200 rounded-md",
        )}
      >
        <Code className="h-6 w-6" />
        <div className="flex flex-col gap-1">
          <h4 className="font-semibold m-0">
            {artifact.title} v{version}
          </h4>
          <span className="text-xs text-gray-500">Click to open code</span>
        </div>
      </div>

      {openOutputPanel && (
        <div
          className="w-[45vw] fixed top-0 right-0 h-screen z-50 artifact-panel animate-slideIn"
          ref={panelRef}
        >
          {result ? (
            <ArtifactOutput
              artifact={artifact}
              result={result}
              version={version}
            />
          ) : (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArtifactOutput({
  artifact,
  result,
  version,
  detail = true,
}: {
  artifact: CodeArtifact;
  result: ArtifactResult;
  version: number;
  detail?: boolean;
}) {
  const fileExtension = artifact.file_path.split(".").pop();
  const markdownCode = `\`\`\`${fileExtension}\n${artifact.code}\n\`\`\``;
  const { url: sandboxUrl, outputUrls, stderr, stdout, runtimeError } = result;

  const handleClosePanel = () => {
    // reset the main div width
    const mainDiv = document.querySelector("main");
    mainDiv?.classList.remove("w-[55vw]");
    mainDiv?.classList.remove("px-8");
    mainDiv?.classList.add("w-screen");

    // hide all current artifact panel
    const artifactPanels = document.querySelectorAll(".artifact-panel");
    artifactPanels.forEach((panel) => {
      panel.classList.add("hidden");
    });
  };

  if (!detail) {
    return (
      <div className="h-[240px] overflow-auto select-none">
        {runtimeError ? (
          <div className="p-4 bg-red-100 text-red-800 rounded-md">
            <h3 className="font-bold mb-2">Runtime Error:</h3>
            <p className="font-semibold">{runtimeError.name}</p>
            <p className="mb-2">{runtimeError.value}</p>
            {runtimeError.tracebackRaw.map((trace, index) => (
              <pre key={index} className="whitespace-pre-wrap text-sm mb-2">
                {trace}
              </pre>
            ))}
          </div>
        ) : (
          <>
            {sandboxUrl && <CodeSandboxPreview url={sandboxUrl} />}
            {outputUrls && <InterpreterOutput outputUrls={outputUrls} />}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center pl-5 pr-10 py-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold m-0">{artifact.title}</h2>
          <span className="text-sm text-gray-500">Version: v{version}</span>
        </div>
        <Button onClick={handleClosePanel}>Close</Button>
      </div>
      <Tabs defaultValue="code" className="h-full p-4 overflow-auto">
        <TabsList className="grid w-full grid-cols-3 max-w-[600px] mx-auto">
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="code" className="h-[80%] mb-4 overflow-auto">
          <div className="m-4 overflow-auto">
            <Markdown content={markdownCode} />
          </div>
        </TabsContent>
        <TabsContent value="preview" className="h-[80%] mb-4 overflow-auto">
          {runtimeError && (
            <div className="p-4 bg-red-100 text-red-800 rounded-md">
              <p className="font-bold mb-2">{runtimeError.name}</p>
              <p className="mb-2">{runtimeError.value}</p>
              {runtimeError.tracebackRaw.map((trace, index) => (
                <pre key={index} className="whitespace-pre-wrap text-sm mb-2">
                  {trace}
                </pre>
              ))}
            </div>
          )}
          {sandboxUrl && <CodeSandboxPreview url={sandboxUrl} />}
          {outputUrls && <InterpreterOutput outputUrls={outputUrls} />}
        </TabsContent>
        <TabsContent value="logs" className="h-[80%] mb-4 overflow-auto">
          <ArtifactLogs stderr={stderr} stdout={stdout} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function CodeSandboxPreview({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);

  return (
    <>
      <iframe
        key={url}
        className="h-full w-full"
        sandbox="allow-forms allow-scripts allow-same-origin"
        loading="lazy"
        src={url}
        onLoad={() => setLoading(false)}
      />
      {loading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      )}
    </>
  );
}

function InterpreterOutput({
  outputUrls,
}: {
  outputUrls: Array<{ url: string; filename: string }>;
}) {
  return (
    <ul className="flex flex-col gap-2 mt-4">
      {outputUrls.map((url) => (
        <li key={url.url}>
          <div className="mt-4">
            {url.filename.endsWith(".png") ||
            url.filename.endsWith(".jpg") ||
            url.filename.endsWith(".jpeg") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url.url} alt={url.filename} className="my-4 w-1/2" />
            ) : (
              <a
                href={url.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline"
              >
                {url.filename}
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ArtifactLogs({
  stderr,
  stdout,
}: {
  stderr?: string[];
  stdout?: string[];
}) {
  if (!stderr?.length && !stdout?.length) {
    return <div className="text-center mt-10">No logs returned</div>;
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      {stderr && stderr.length > 0 && (
        <div>
          <h3>Stderr</h3>
          <ArtifactLogItems logs={stderr} />
        </div>
      )}
      {stdout && stdout.length > 0 && (
        <div>
          <h3>Stdout</h3>
          <ArtifactLogItems logs={stdout} />
        </div>
      )}
    </div>
  );
}

function ArtifactLogItems({ logs }: { logs: string[] }) {
  return (
    <ul className="flex flex-col gap-2 border border-gray-200 rounded-md p-4">
      {logs.map((log) => (
        <li key={log}>
          <code>{log}</code>
        </li>
      ))}
    </ul>
  );
}

import { JSONValue } from "ai";
import { Code, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "../../button";
import { cn } from "../../lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../tabs";
import Markdown from "../chat-message/markdown";

// detail information to execute code
type Artifact = {
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
  sandboxUrl?: string; // the url to the sandbox (output when running web app)
  outputUrls?: Array<{
    url: string;
    filename: string;
  }>; // the urls to the output files (output when running in python environment)
  stdout?: string[];
  stderr?: string[];
};

type ArtifactData = {
  versionId?: string;
  artifact?: Artifact;
  result?: ArtifactResult;
};

export function Artifact({ data }: { data: JSONValue }) {
  const artifact = (data as ArtifactData) ?? {};
  const [openOutputPanel, setOpenOutputPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
    mainDiv?.classList.add("w-[55vw]");

    // show the current artifact panel
    panelRef.current?.classList.remove("hidden");
  };

  const handleOpenOutput = () => {
    setOpenOutputPanel(true);
    handleDOMLayout();
  };

  useEffect(() => {
    // auto open output panel
    handleOpenOutput();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!artifact.artifact) return null;

  return (
    <div>
      <div
        className={cn(
          buttonVariants({ variant: "default" }),
          "h-auto flex gap-4 w-max cursor-pointer px-6 py-3",
        )}
        onClick={handleOpenOutput}
      >
        <Code className="h-6 w-6" />
        <div className="flex flex-col gap-1">
          <h4 className="font-semibold m-0">{artifact.artifact.title}</h4>
          <span className="text-xs">Version ID: {artifact.versionId}</span>
        </div>
      </div>
      {openOutputPanel && (
        <div
          className="w-[45vw] fixed top-0 right-0 h-screen z-50 artifact-panel"
          ref={panelRef}
        >
          <ArtifactOutput data={data as ArtifactData} />
        </div>
      )}
    </div>
  );
}

function ArtifactOutput({ data }: { data: ArtifactData }) {
  const { artifact, result } = (data as ArtifactData) ?? {};
  if (!artifact || !result) return null;

  const fileExtension = artifact.file_path.split(".").pop();
  const markdownCode = `\`\`\`${fileExtension}\n${artifact.code}\n\`\`\``;
  const { sandboxUrl, outputUrls, stderr, stdout } = result;

  const handleClosePanel = () => {
    // reset the main div width
    const mainDiv = document.querySelector("main");
    mainDiv?.classList.remove("w-[55vw]");

    // hide all current artifact panel
    const artifactPanels = document.querySelectorAll(".artifact-panel");
    artifactPanels.forEach((panel) => {
      panel.classList.add("hidden");
    });
  };

  return (
    <>
      <div className="flex justify-between items-center pl-5 pr-10 py-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold m-0">{artifact.title}</h2>
          <span className="text-sm text-gray-500">
            Version ID: {data.versionId}
          </span>
        </div>
        <Button onClick={handleClosePanel}>Close</Button>
      </div>
      <Tabs defaultValue="code" className="h-full p-4 overflow-auto">
        <TabsList className="grid w-full grid-cols-3 max-w-[600px] mx-auto">
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="code" className="h-[90%]">
          <div className="m-4 overflow-auto">
            <Markdown content={markdownCode} />
          </div>
        </TabsContent>
        <TabsContent value="preview" className="h-[90%]">
          {sandboxUrl && <CodeSandboxPreview url={sandboxUrl} />}
          {outputUrls && <InterpreterOutput outputUrls={outputUrls} />}
        </TabsContent>
        <TabsContent value="logs" className="h-[90%]">
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
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2">
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
    <ul className="flex flex-col gap-2 list-disc list-inside">
      {outputUrls.map((url, index) => (
        <li key={url.url}>
          <span>
            File Output {index + 1}:{" "}
            <a
              href={url.url}
              target="_blank"
              className="text-blue-400 underline"
            >
              {url.filename}
            </a>
          </span>
          {url.filename.endsWith(".png") ||
          url.filename.endsWith(".jpg") ||
          url.filename.endsWith(".jpeg") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url.url} alt={url.filename} className="my-4 w-2/3" />
          ) : null}
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

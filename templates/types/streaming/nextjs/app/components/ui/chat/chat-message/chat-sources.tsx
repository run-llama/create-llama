import { Check, Copy, FileText } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
import { Button } from "../../button";
import { FileIcon } from "../../document-preview";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../hover-card";
import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard";
import { DocumentFileType, SourceData } from "../index";
import PdfDialog from "../widgets/PdfDialog";

function SourceNumberButton({ index }: { index: number }) {
  return (
    <div className="text-xs w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center hover:text-white hover:bg-primary hover:cursor-pointer">
      {index + 1}
    </div>
  );
}

type NodeInfo = {
  id: string;
  url?: string;
  text?: string;
  file_name?: string;
  metadata?: Record<string, unknown>;
};

type Document = {
  url: string;
  sources: NodeInfo[];
};

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}

export function ChatSources({ data }: { data: SourceData }) {
  const documents: Document[] = useMemo(() => {
    // group nodes by url
    const nodesByUrl: { [path: string]: NodeInfo[] } = {};
    data.nodes
      .sort((a, b) => (b.score ?? 1) - (a.score ?? 1))
      .forEach((node) => {
        const nodeInfo = {
          id: node.id,
          url: node.url,
          text: node.text,
          file_name: node.metadata?.file_name as string | undefined,
          metadata: node.metadata,
        };
        const key = nodeInfo.url ?? nodeInfo.id; // use id as key for UNKNOWN type
        if (!nodesByUrl[key]) {
          nodesByUrl[key] = [nodeInfo];
        } else {
          nodesByUrl[key].push(nodeInfo);
        }
      });

    // convert to array of documents
    return Object.entries(nodesByUrl).map(([url, sources]) => ({
      url,
      sources,
    }));
  }, [data.nodes]);

  if (documents.length === 0) return null;

  return (
    <div className="space-y-2 text-sm">
      <div className="font-semibold text-lg">Sources:</div>
      <div className="flex gap-3 flex-wrap">
        {documents.map((document) => {
          return <DocumentInfo key={document.url} document={document} />;
        })}
      </div>
    </div>
  );
}

function DocumentInfo({ document }: { document: Document }) {
  if (!document.sources.length) return null;
  const { url, sources } = document;
  const file_name = sources[0].file_name;
  const file_ext = file_name?.split(".").pop();
  const fileImage = FileIcon[file_ext as DocumentFileType];

  const DocumentDetail = (
    <div
      key={url}
      className="h-28 w-48 flex flex-col justify-between p-4 border rounded-md shadow-md cursor-pointer"
    >
      <p title={file_name} className="truncate text-left">
        {file_name}
      </p>
      <div className="flex justify-between items-center">
        <div className="space-x-2 flex">
          {sources.map((nodeInfo: NodeInfo, index: number) => {
            return (
              <div key={nodeInfo.id}>
                <HoverCard>
                  <HoverCardTrigger>
                    <SourceNumberButton index={index} />
                  </HoverCardTrigger>
                  <HoverCardContent className="w-[400px]">
                    <NodeInfo nodeInfo={nodeInfo} />
                  </HoverCardContent>
                </HoverCard>
              </div>
            );
          })}
        </div>
        {fileImage ? (
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md">
            <Image
              className="h-full w-auto"
              priority
              src={fileImage}
              alt="Icon"
            />
          </div>
        ) : (
          <FileText className="text-gray-500" />
        )}
      </div>
    </div>
  );

  if (!isValidUrl(url)) {
    // only display document card if no valid url
    return DocumentDetail;
  }

  if (url.endsWith(".pdf")) {
    // open internal pdf dialog for pdf files when click document card
    return (
      <PdfDialog
        documentId={document.url}
        url={document.url}
        trigger={DocumentDetail}
      />
    );
  }
  // open external link when click document card for other file types
  return <div onClick={() => window.open(url, "_blank")}>{DocumentDetail}</div>;
}

function NodeInfo({ nodeInfo }: { nodeInfo: NodeInfo }) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 1000 });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="font-semibold">Node content</span>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            nodeInfo.text && copyToClipboard(nodeInfo.text);
          }}
          size="icon"
          variant="ghost"
          className="h-12 w-12 shrink-0"
        >
          {isCopied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      {nodeInfo.url?.endsWith(".pdf") && (
        <p>
          On page{" "}
          {
            (nodeInfo.metadata?.page_number ??
              nodeInfo.metadata?.page_label) as number
          }
          :
        </p>
      )}
      {nodeInfo.url && !nodeInfo.url.endsWith(".pdf") && (
        <a
          href={nodeInfo.url}
          target="_blank"
          className="text-blue-900 truncate block"
        >
          {nodeInfo.url}
        </a>
      )}
      {nodeInfo.text && (
        <pre className="max-h-[200px] overflow-auto whitespace-pre-line">
          {nodeInfo.text}
        </pre>
      )}
    </div>
  );
}

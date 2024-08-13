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
import { cn } from "../../lib/utils";
import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard";
import { DocumentFileType, SourceData, SourceNode } from "../index";
import PdfDialog from "../widgets/PdfDialog";

const SCORE_THRESHOLD = 0.25;

type Document = {
  url: string;
  sources: SourceNode[];
};

type Citation = {
  order: number;
  id: string;
  node?: SourceNode;
};

function extractCitations(text: string): Citation[] {
  // Define the regular expression to match the references
  const referenceRegex = /\[(\d+)\]:\s+(.+)\s+["'](.+?)["']/g;
  const citations: Citation[] = [];
  let match;

  // Find all the references in the text
  while ((match = referenceRegex.exec(text)) !== null) {
    citations.push({
      order: parseInt(match[1], 10),
      id: match[2],
    });
  }

  return citations;
}

/**
 * Filter the source nodes mentioned in the citation
 */
function filterSourcesByCitation({
  data,
  messageContent,
}: {
  data: SourceData;
  messageContent: string;
}) {
  // group nodes by document (a document must have a URL)
  const nodesByUrl: Record<string, SourceNode[]> = {};
  const citations = extractCitations(messageContent);

  // Update nodes with citations
  citations
    .map((citation) => {
      // Remove hashtag from id (temporarily for now to identify the link in markdown is a citation)
      const citationNodeId = citation.id.replace(/^#/, "");
      const node = data.nodes.find((node) => node.id === citationNodeId);
      citation.node = node;
      return citation;
    })
    .sort((a, b) => (a.order ?? 1) - (b.order ?? 1))
    .filter((citation) => citation.node !== undefined)
    .forEach((citation) => {
      const key = citation.node?.url!.replace(/\/$/, ""); // remove trailing slash
      if (key !== undefined && citation.node) {
        nodesByUrl[key] ??= [];
        nodesByUrl[key].push(citation.node);
      }
    });

  // convert to array of documents
  return Object.entries(nodesByUrl).map(([url, sources]) => ({
    url,
    sources,
  }));
}

/**
 * Filter the source nodes have score greater than SCORE_THRESHOLD
 */
function filterSourcesByScores({ data }: { data: SourceData }) {
  // group nodes by document (a document must have a URL)
  const nodesByUrl: Record<string, SourceNode[]> = {};
  data.nodes
    .filter((node) => (node.score ?? 1) > SCORE_THRESHOLD)
    .filter((node) => isValidUrl(node.url))
    .sort((a, b) => (b.score ?? 1) - (a.score ?? 1))
    .forEach((node) => {
      const key = node.url!.replace(/\/$/, ""); // remove trailing slash
      nodesByUrl[key] ??= [];
      nodesByUrl[key].push(node);
    });

  // convert to array of documents
  return Object.entries(nodesByUrl).map(([url, sources]) => ({
    url,
    sources,
  }));
}

export function ChatSources({
  data,
  messageContent,
}: {
  data: SourceData;
  messageContent: string;
}) {
  const documents: Document[] = useMemo(() => {
    // Try extracting sources by citation first
    const sources = filterSourcesByCitation({ data, messageContent });
    if (sources.length > 0) return sources;
    // If no citation sources are found, extract sources by scores
    else return filterSourcesByScores({ data });
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

function SourceNumberButton({ index }: { index: number }) {
  return (
    <div className="text-xs w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center hover:text-white hover:bg-primary ">
      {index + 1}
    </div>
  );
}

function DocumentInfo({ document }: { document: Document }) {
  if (!document.sources.length) return null;
  const { url, sources } = document;
  const fileName = sources[0].metadata.file_name as string | undefined;
  const fileExt = fileName?.split(".").pop();
  const fileImage = fileExt ? FileIcon[fileExt as DocumentFileType] : null;

  const DocumentDetail = (
    <div
      key={url}
      className="h-28 w-48 flex flex-col justify-between p-4 border rounded-md shadow-md cursor-pointer"
    >
      <p
        title={fileName}
        className={cn(
          fileName ? "truncate" : "text-blue-900 break-words",
          "text-left",
        )}
      >
        {fileName ?? url}
      </p>
      <div className="flex justify-between items-center">
        <div className="space-x-2 flex">
          {sources.map((node: SourceNode, index: number) => {
            return (
              <div key={node.id}>
                <HoverCard>
                  <HoverCardTrigger
                    className="cursor-default"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <SourceNumberButton index={index} />
                  </HoverCardTrigger>
                  <HoverCardContent className="w-[400px]">
                    <NodeInfo nodeInfo={node} />
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

function NodeInfo({ nodeInfo }: { nodeInfo: SourceNode }) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 1000 });

  const pageNumber =
    // XXX: page_label is used in Python, but page_number is used by Typescript
    (nodeInfo.metadata?.page_number as number) ??
    (nodeInfo.metadata?.page_label as number) ??
    null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="font-semibold">
          {pageNumber ? `On page ${pageNumber}: ` : "Node content:"}
        </span>
        {nodeInfo.text && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(nodeInfo.text);
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
        )}
      </div>

      {nodeInfo.text && (
        <pre className="max-h-[200px] overflow-auto whitespace-pre-line">
          &ldquo;{nodeInfo.text}&rdquo;
        </pre>
      )}
    </div>
  );
}

function isValidUrl(url?: string): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}

import { Check, Copy } from "lucide-react";
import { useMemo } from "react";
import { Button } from "../button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../hover-card";
import { getStaticFileDataUrl } from "../lib/url";
import { SourceData, SourceNode } from "./index";
import { useCopyToClipboard } from "./use-copy-to-clipboard";
import PdfDialog from "./widgets/PdfDialog";

const SCORE_THRESHOLD = 0.5;

function SourceNumberButton({ index }: { index: number }) {
  return (
    <div className="text-xs w-5 h-5 rounded-full bg-gray-100 mb-2 flex items-center justify-center hover:text-white hover:bg-primary hover:cursor-pointer">
      {index + 1}
    </div>
  );
}

enum NODE_TYPE {
  URL,
  FILE,
}

type NodeInfo = {
  type: NODE_TYPE;
  path: string;
  url: string;
  id: string;
};

type SourceNodeDetail = SourceNode & { info: NodeInfo | undefined };

function getNodeInfo(node: SourceNode): NodeInfo | undefined {
  if (typeof node.metadata["URL"] === "string") {
    const url = node.metadata["URL"];
    return {
      id: node.id,
      type: NODE_TYPE.URL,
      path: url,
      url,
    };
  }
  if (typeof node.metadata["file_path"] === "string") {
    const fileName = node.metadata["file_name"] as string;
    return {
      id: node.id,
      type: NODE_TYPE.FILE,
      path: node.metadata["file_path"],
      url: getStaticFileDataUrl(fileName),
    };
  }
  return undefined;
}

export function ChatSources({ data }: { data: SourceData }) {
  const sources: SourceNodeDetail[] = useMemo(() => {
    // aggregate nodes by url or file_path (get the highest one by score)
    const nodePaths = new Set<string>();
    const uniqueNodes: SourceNodeDetail[] = [];

    data.nodes
      .sort((a, b) => (b.score ?? 1) - (a.score ?? 1))
      .forEach((node) => {
        const nodeInfo = getNodeInfo(node);
        if (!nodeInfo) {
          uniqueNodes.push({ ...node, info: undefined }); // Always add nodes with unknown type
        } else if (!nodePaths.has(nodeInfo.path)) {
          uniqueNodes.push({ ...node, info: nodeInfo });
          nodePaths.add(nodeInfo.path);
        }
      });

    return uniqueNodes
      .filter((node) => Object.keys(node.metadata).length > 0)
      .filter((node) => (node.score ?? 1) > SCORE_THRESHOLD);
  }, [data.nodes]);

  if (sources.length === 0) return null;

  return (
    <div className="space-x-2 text-sm">
      <span className="font-semibold">Sources:</span>
      <div className="inline-flex gap-1 items-center">
        {sources.map((node: SourceNodeDetail, index: number) => {
          if (node.info?.path.endsWith(".pdf")) {
            return (
              <PdfDialog
                key={node.id}
                documentId={node.id}
                url={node.info.url}
                path={node.info.path}
                trigger={<SourceNumberButton index={index} />}
              />
            );
          }
          return (
            <div key={node.id}>
              <HoverCard>
                <HoverCardTrigger>
                  <SourceNumberButton index={index} />
                </HoverCardTrigger>
                <HoverCardContent className="w-[320px]">
                  <NodeInfo node={node} />
                </HoverCardContent>
              </HoverCard>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NodeInfo({ node }: { node: SourceNodeDetail }) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 1000 });
  const nodeInfo = node.info;

  if (nodeInfo?.url) {
    // this is a node generated by the web loader or file loader,
    // add a link to view its URL and a button to copy the URL to the clipboard
    return (
      <div className="flex items-center my-2">
        <a className="hover:text-blue-900" href={nodeInfo?.url} target="_blank">
          <span>{nodeInfo.path}</span>
        </a>
        <Button
          onClick={() => copyToClipboard(nodeInfo.path)}
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
    );
  }

  // node generated by unknown loader, implement renderer by analyzing logged out metadata
  console.log("Node metadata", node.metadata);
  return (
    <p>
      Sorry, unknown node type. Please add a new renderer in the NodeInfo
      component.
    </p>
  );
}

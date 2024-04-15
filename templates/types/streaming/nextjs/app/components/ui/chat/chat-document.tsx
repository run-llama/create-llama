import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { ArrowUpRightSquare, Check, Copy } from "lucide-react";
import { useMemo } from "react";
import { Button } from "../button";
import { SourceData, SourceNode } from "./index";
import { useCopyToClipboard } from "./use-copy-to-clipboard";

const SCORE_THRESHOLD = 0.5;

function NodeMetaInfo({ node }: { node: SourceNode }) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 500 });

  if (node.metadata["url"]) {
    return (
      <a
        className="space-x-2 flex items-start my-2 hover:text-blue-900"
        href={node.metadata["url"] as string}
        target="_blank"
      >
        <span>Document URL</span>
        <ArrowUpRightSquare className="w-4 h-4" />
      </a>
    );
  }

  if (
    node.metadata["file_path"] &&
    process.env.NEXT_PUBLIC_SHOW_LOCAL_FILES === "true"
  ) {
    const fileURL = `file:///${node.metadata["file_path"]}`;
    return (
      <div className="flex items-center border rounded-md px-2 py-1 justify-between my-2">
        <span>File URL: {fileURL}</span>
        <Button
          onClick={() => copyToClipboard(fileURL)}
          size="icon"
          variant="ghost"
          className="h-8 w-8"
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

  return null;
}

export function ChatSources({ data }: { data: SourceData }) {
  const sources = useMemo(() => {
    return (
      data.nodes
        ?.filter((node) => (node.score ?? 1) > SCORE_THRESHOLD)
        .sort((a, b) => (b.score ?? 1) - (a.score ?? 1)) || []
    );
  }, [data.nodes]);

  if (sources.length === 0) return null;

  return (
    <div className="space-x-2 text-sm">
      <span className="font-semibold">Sources:</span>
      <div className="inline-flex gap-1 items-center">
        {sources.map((node: any, index: number) => (
          <div key={node.id}>
            <Dialog>
              <DialogTrigger onClick={() => console.log("Detail node", node)}>
                <div className="text-xs w-5 h-5 rounded-full bg-gray-100 mb-2 flex items-center justify-center hover:text-white hover:bg-primary">
                  {index + 1}
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-[800px]">
                <DialogHeader>
                  <DialogTitle>Detail Information</DialogTitle>
                  <DialogDescription asChild>
                    <div>
                      <b className="block">Node ID: {node.id}</b>
                      <NodeMetaInfo node={node} />
                      <p className="mt-4 max-h-80 whitespace-pre-wrap overflow-auto">
                        {node.text}
                      </p>
                    </div>
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </div>
        ))}
      </div>
    </div>
  );
}

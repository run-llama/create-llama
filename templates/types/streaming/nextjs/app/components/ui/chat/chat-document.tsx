import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { useMemo } from "react";
import { SourceData } from "./index";

const SCORE_THRESHOLD = 0.5;

export function ChatSources({ data }: { data: SourceData }) {
  const sources = useMemo(() => {
    return (
      data.nodes
        ?.filter((node) => node.score > SCORE_THRESHOLD)
        .sort((a, b) => b.score - a.score) || []
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

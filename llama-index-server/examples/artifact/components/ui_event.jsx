import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Markdown } from "@llamaindex/chat-ui/widgets";
import { ListChecks, Loader2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";

const STAGE_META = {
  plan: {
    icon: ListChecks,
    badgeText: "Step 1/2: Planning",
    gradient: "from-blue-100 via-blue-50 to-white",
    progress: 33,
    iconBg: "bg-blue-100 text-blue-600",
    badge: "bg-blue-100 text-blue-700",
  },
  generate: {
    icon: Wand2,
    badgeText: "Step 2/2: Generating",
    gradient: "from-violet-100 via-violet-50 to-white",
    progress: 66,
    iconBg: "bg-violet-100 text-violet-600",
    badge: "bg-violet-100 text-violet-700",
  },
};

function ArtifactWorkflowCard({ event }) {
  const [visible, setVisible] = useState(event?.state !== "completed");
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (event?.state === "completed") {
      setVisible(false);
    } else {
      setVisible(true);
      setFade(false);
    }
  }, [event?.state]);

  if (!event || !visible) return null;

  const { state, requirement } = event;
  const meta = STAGE_META[state];

  if (!meta) return null;

  return (
    <div className="flex justify-center items-center w-full min-h-[180px] py-2">
      <Card
        className={cn(
          "w-full shadow-md rounded-xl transition-all duration-500",
          "border-0",
          fade && "opacity-0 pointer-events-none",
          `bg-gradient-to-br ${meta.gradient}`,
        )}
        style={{
          boxShadow:
            "0 2px 12px 0 rgba(80, 80, 120, 0.08), 0 1px 3px 0 rgba(80, 80, 120, 0.04)",
        }}
      >
        <CardHeader className="flex flex-row items-center gap-2 pb-1 pt-2 px-3">
          <div
            className={cn(
              "rounded-full p-1 flex items-center justify-center",
              meta.iconBg,
            )}
          >
            <meta.icon className="w-5 h-5" />
          </div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Badge className={cn("ml-1", meta.badge, "text-xs px-2 py-0.5")}>
              {meta.badgeText}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 py-1">
          {state === "plan" && (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="animate-spin text-blue-400 w-6 h-6 mb-1" />
              <div className="text-sm text-blue-900 font-medium text-center">
                Analyzing your request...
              </div>
              <Skeleton className="w-1/2 h-3 rounded-full mt-1" />
            </div>
          )}
          {state === "generate" && (
            <div className="flex flex-col gap-2 py-2">
              <div className="flex items-center gap-1">
                <Loader2 className="animate-spin text-violet-400 w-4 h-4" />
                <span className="text-violet-900 font-medium text-sm">
                  Working on the requirement:
                </span>
              </div>
              <div className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 max-h-24 overflow-auto text-xs">
                {requirement ? (
                  <Markdown content={requirement} />
                ) : (
                  <span className="text-violet-400 italic">
                    No requirements available yet.
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
        <div className="px-3 pb-2 pt-1">
          <Progress
            value={meta.progress}
            className={cn(
              "h-1 rounded-full bg-gray-200",
              state === "plan" && "bg-blue-200",
              state === "generate" && "bg-violet-200",
            )}
            indicatorClassName={cn(
              "transition-all duration-500",
              state === "plan" && "bg-blue-500",
              state === "generate" && "bg-violet-500",
            )}
          />
        </div>
      </Card>
    </div>
  );
}

export default function Component({ events }) {
  const aggregateEvents = () => {
    if (!events || events.length === 0) return null;
    return events[events.length - 1];
  };

  const event = aggregateEvents();

  return <ArtifactWorkflowCard event={event} />;
}

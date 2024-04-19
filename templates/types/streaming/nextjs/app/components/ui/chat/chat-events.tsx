import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../collapsible";
import { EventData } from "./index";

export function ChatEvents({
  data,
  isFinished,
  isStreaming,
}: {
  data: EventData[];
  isFinished: boolean;
  isStreaming: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    setIsOpen(!isFinished);
  }, [isFinished]);

  const buttonLabel = isStreaming
    ? "In progress"
    : isOpen
      ? "Hide events"
      : "Show events";

  const EventIcon = isStreaming ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : isOpen ? (
    <ChevronDown className="h-4 w-4" />
  ) : (
    <ChevronRight className="h-4 w-4" />
  );

  return (
    <div className="border-l-2 border-indigo-400 pl-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="secondary" className="space-x-2">
            <span>{buttonLabel}</span>
            {EventIcon}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent asChild>
          <div className="mt-4 text-sm space-y-2">
            {data.map((eventItem, index) => (
              <div key={index}>{eventItem.title}</div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

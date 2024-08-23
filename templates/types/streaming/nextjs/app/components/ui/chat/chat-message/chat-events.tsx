import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../collapsible";
import { EventData } from "../index";

type MergedEvent = {
  agent?: string;
  titles: string[];
};

function mergeAdjacentEvents(events: EventData[]): MergedEvent[] {
  const mergedEvents: MergedEvent[] = [];

  for (const event of events) {
    const lastMergedEvent = mergedEvents[mergedEvents.length - 1];

    if (
      lastMergedEvent &&
      lastMergedEvent.agent === event.agent &&
      event.agent !== null
    ) {
      // If the last event in mergedEvents has the same non-null agent, add the title to it
      lastMergedEvent.titles.push(event.title);
    } else {
      // Otherwise, create a new merged event
      mergedEvents.push({ agent: event.agent, titles: [event.title] });
    }
  }

  return mergedEvents;
}

export function ChatEvents({
  data,
  isLoading,
}: {
  data: EventData[];
  isLoading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const buttonLabel = isOpen ? "Hide events" : "Show events";

  const EventIcon = isOpen ? (
    <ChevronDown className="h-4 w-4" />
  ) : (
    <ChevronRight className="h-4 w-4" />
  );

  const events = useMemo(() => mergeAdjacentEvents(data), [data]);

  return (
    <div className="border-l-2 border-indigo-400 pl-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="secondary" className="space-x-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{buttonLabel}</span>
            {EventIcon}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent asChild>
          <div className="mt-4 text-sm space-y-4">
            {events.map((eventItem, index) => (
              <div key={index} className="flex gap-4 border-b pb-4">
                <div className="w-[150px]">
                  <span className="text-purple-700 font-bold">
                    {eventItem.agent ?? "System"}
                  </span>
                </div>
                <ul className="flex-1 list-decimal space-y-2">
                  {eventItem.titles.map((title, index) => (
                    <li className="whitespace-break-spaces" key={index}>
                      {title}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

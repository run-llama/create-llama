import { icons } from "lucide-react";
import { useMemo } from "react";
import { AgentEventData } from "../index";

type MergedEvent = {
  agent: string;
  texts: string[];
  iconName?: string; // lucide icon name
};

export function ChatAgentEvents({ data }: { data: AgentEventData[] }) {
  const events = useMemo(() => mergeAdjacentEvents(data), [data]);
  return (
    <div className="border-l-2 border-purple-400 pl-2">
      <div className="mt-4 text-sm space-y-4">
        {events.map((eventItem, index) => {
          const iconName = (eventItem.iconName ?? "Bot") as keyof typeof icons;
          const AgentIcon = icons[iconName] ?? icons.Bot;
          return (
            <div key={index} className="flex gap-4 border-b pb-4">
              <div className="w-[150px] text-purple-700 flex flex-col items-center gap-2">
                <AgentIcon />
                <span className="font-bold">{eventItem.agent}</span>
              </div>
              <ul className="flex-1 list-decimal space-y-2">
                {eventItem.texts.map((text, index) => (
                  <li className="whitespace-break-spaces" key={index}>
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function mergeAdjacentEvents(events: AgentEventData[]): MergedEvent[] {
  const mergedEvents: MergedEvent[] = [];

  for (const event of events) {
    const lastMergedEvent = mergedEvents[mergedEvents.length - 1];

    if (lastMergedEvent && lastMergedEvent.agent === event.agent) {
      // If the last event in mergedEvents has the same non-null agent, add the title to it
      lastMergedEvent.texts.push(event.text);
    } else {
      // Otherwise, create a new merged event
      mergedEvents.push({
        agent: event.agent,
        texts: [event.text],
        iconName: event.iconName,
      });
    }
  }

  return mergedEvents;
}

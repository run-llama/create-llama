import { icons, LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { AgentEventData } from "../index";

const AgentIcons: Record<string, LucideIcon> = {
  bot: icons.Bot,
  researcher: icons.ScanSearch,
  writer: icons.PenLine,
  reviewer: icons.MessageCircle,
};

type MergedEvent = {
  agent: string;
  texts: string[];
  icon: LucideIcon;
};

export function ChatAgentEvents({ data }: { data: AgentEventData[] }) {
  const events = useMemo(() => mergeAdjacentEvents(data), [data]);
  return (
    <div className="pl-2">
      <div className="text-sm space-y-4">
        {events.map((eventItem, index) => (
          <AgentEventContent key={index} event={eventItem} />
        ))}
      </div>
    </div>
  );
}

const MAX_TEXT_LENGTH = 80;

function AgentEventContent({ event }: { event: MergedEvent }) {
  const [showFull, setShowFull] = useState(false);
  const toggleShowFull = () => {
    setShowFull((prev) => !prev);
  };
  const { agent, texts } = event;
  const AgentIcon = event.icon;
  return (
    <div className="flex gap-4 border-b pb-4 items-center fadein-agent">
      <div className="w-[100px] flex flex-col items-center gap-2">
        <AgentIcon />
        <span className="font-bold">{agent}</span>
      </div>
      <ul className="flex-1 list-decimal space-y-2">
        {texts.map((text, index) => (
          <li className="whitespace-break-spaces" key={index}>
            {text.length <= MAX_TEXT_LENGTH && <span>{text}</span>}
            {text.length > MAX_TEXT_LENGTH && (
              <div>
                <span>
                  {showFull ? text : `${text.slice(0, MAX_TEXT_LENGTH)}...`}
                </span>
                <span
                  className="font-semibold underline cursor-pointer ml-2"
                  onClick={toggleShowFull}
                >
                  {showFull ? "Show less" : "Show more"}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
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
        icon: AgentIcons[event.agent] ?? icons.Bot,
      });
    }
  }

  return mergedEvents;
}

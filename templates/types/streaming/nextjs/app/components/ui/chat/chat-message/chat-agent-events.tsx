import { icons, LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { Button } from "../../button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../../drawer";
import { AgentEventData } from "../index";
import Markdown from "./markdown";

const AgentIcons: Record<string, LucideIcon> = {
  bot: icons.Bot,
  researcher: icons.ScanSearch,
  writer: icons.PenLine,
  reviewer: icons.MessageCircle,
  publisher: icons.BookCheck,
};

type MergedEvent = {
  agent: string;
  texts: string[];
  icon: LucideIcon;
};

export function ChatAgentEvents({
  data,
  isFinished,
}: {
  data: AgentEventData[];
  isFinished: boolean;
}) {
  const events = useMemo(() => mergeAdjacentEvents(data), [data]);
  return (
    <div className="pl-2">
      <div className="text-sm space-y-4">
        {events.map((eventItem, index) => (
          <AgentEventContent
            key={index}
            event={eventItem}
            isLast={index === events.length - 1}
            isFinished={isFinished}
          />
        ))}
      </div>
    </div>
  );
}

const MAX_TEXT_LENGTH = 150;

function AgentEventContent({
  event,
  isLast,
  isFinished,
}: {
  event: MergedEvent;
  isLast: boolean;
  isFinished: boolean;
}) {
  const { agent, texts } = event;
  const AgentIcon = event.icon;
  return (
    <div className="flex gap-4 border-b pb-4 items-center fadein-agent">
      <div className="w-[100px] flex flex-col items-center gap-2">
        <div className="relative">
          {isLast && !isFinished && (
            <div className="absolute -top-0 -right-4">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
              </span>
            </div>
          )}
          <AgentIcon />
        </div>
        <span className="font-bold">{agent}</span>
      </div>
      <ul className="flex-1 list-decimal space-y-2">
        {texts.map((text, index) => (
          <li className="whitespace-break-spaces" key={index}>
            {text.length <= MAX_TEXT_LENGTH && <span>{text}</span>}
            {text.length > MAX_TEXT_LENGTH && (
              <div>
                <span>{text.slice(0, MAX_TEXT_LENGTH)}...</span>
                <AgentEventDialog
                  content={text}
                  title={`Agent "${agent}" - Step: ${index + 1}`}
                >
                  <span className="font-semibold underline cursor-pointer ml-2">
                    Show more
                  </span>
                </AgentEventDialog>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

type AgentEventDialogProps = {
  title: string;
  content: string;
  children: React.ReactNode;
};

function AgentEventDialog(props: AgentEventDialogProps) {
  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>{props.children}</DrawerTrigger>
      <DrawerContent className="w-3/5 mt-24 h-full max-h-[96%] ">
        <DrawerHeader className="flex justify-between">
          <div className="space-y-2">
            <DrawerTitle>{props.title}</DrawerTitle>
          </div>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="m-4 overflow-auto">
          <Markdown content={props.content} />
        </div>
      </DrawerContent>
    </Drawer>
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

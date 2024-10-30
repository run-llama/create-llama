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
import { Progress } from "../../progress";
import { AgentEventData, ProgressData } from "../index";
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
  progress?: ProgressData;
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
const MAX_LINES = 3;

function TextContent({
  texts,
  maxLength = MAX_TEXT_LENGTH,
  maxLines = MAX_LINES,
}: {
  texts: string[];
  maxLength?: number;
  maxLines?: number;
}) {
  return (
    <>
      <ul className="list-decimal space-y-2">
        {texts.slice(0, maxLines).map((text, index) => (
          <li className="whitespace-break-spaces" key={index}>
            {text.slice(0, maxLength)}
            {text.length > maxLength && "..."}
          </li>
        ))}
      </ul>
      {texts.length > maxLines && (
        <AgentEventDialog
          content={texts.map((text) => `\n${text}\n`).join("")}
          title={`All Steps`}
        >
          <span className="font-semibold underline cursor-pointer">
            Show all
          </span>
        </AgentEventDialog>
      )}
    </>
  );
}

function ProgressContent({
  progress,
  isFinished,
  msg,
}: {
  progress: ProgressData;
  isFinished: boolean;
  msg?: string;
}) {
  const progressValue =
    progress.total !== 0
      ? Math.round(((progress.current + 1) / progress.total) * 100)
      : 0;

  return (
    <div className="space-y-2 mt-2">
      {!isFinished && msg && (
        <p className="text-sm text-muted-foreground">{msg}</p>
      )}
      <Progress value={progressValue} className="w-full h-2" />
      <p className="text-sm text-muted-foreground">
        {isFinished ? "Processed" : "Processing"} {progress.current + 1} of{" "}
        {progress.total} steps...
      </p>
    </div>
  );
}

function AgentEventContent({
  event,
  isLast,
  isFinished,
}: {
  event: MergedEvent;
  isLast: boolean;
  isFinished: boolean;
}) {
  const { agent, texts, progress } = event;
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
      <div className="flex-1">
        {texts.length > 0 && (
          <TextContent texts={texts} maxLines={progress ? 1 : MAX_LINES} />
        )}
        {progress && (
          <ProgressContent
            progress={progress}
            isFinished={isFinished}
            msg={texts[texts.length - 1]}
          />
        )}
      </div>
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

    const progressData = event.data;
    if (lastMergedEvent && lastMergedEvent.agent === event.agent) {
      // Update for the last merged event
      lastMergedEvent.progress = progressData;
      lastMergedEvent.texts.push(event.text);
    } else {
      mergedEvents.push({
        agent: event.agent,
        texts: [event.text],
        icon: AgentIcons[event.agent.toLowerCase()] ?? icons.Bot,
        progress: progressData,
      });
    }
  }

  return mergedEvents;
}

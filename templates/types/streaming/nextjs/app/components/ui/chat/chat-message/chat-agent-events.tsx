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

type StepText = {
  text: string;
};

type StepProgress = {
  text: string;
  progress: ProgressData;
};

type MergedEvent = {
  agent: string;
  icon: LucideIcon;
  steps: Array<StepText | StepProgress>;
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

function TextContent({ agent, step }: { agent: string; step: StepText }) {
  const { displayText, showMore } = useMemo(
    () => ({
      displayText: step.text.slice(0, MAX_TEXT_LENGTH),
      showMore: step.text.length > MAX_TEXT_LENGTH,
    }),
    [step.text],
  );

  return (
    <>
      <div className="whitespace-break-spaces">
        {!showMore && <span>{step.text}</span>}
        {showMore && (
          <div>
            <span>{displayText}...</span>
            <AgentEventDialog content={step.text} title={`Agent "${agent}"`}>
              <span className="font-semibold underline cursor-pointer ml-2">
                Show more
              </span>
            </AgentEventDialog>
          </div>
        )}
      </div>
    </>
  );
}

function ProgressContent({ step }: { step: StepProgress }) {
  const progressValue =
    step.progress.total !== 0
      ? Math.round(((step.progress.current + 1) / step.progress.total) * 100)
      : 0;

  return (
    <div className="space-y-2 mt-2">
      {step.text && (
        <p className="text-sm text-muted-foreground">{step.text}</p>
      )}
      <Progress value={progressValue} className="w-full h-2" />
      <p className="text-sm text-muted-foreground">
        Processing {step.progress.current + 1} of {step.progress.total} steps...
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
  const { agent, steps } = event;
  const AgentIcon = event.icon;
  const textSteps = steps.filter((step) => !("progress" in step));
  const progressSteps = steps.filter(
    (step) => "progress" in step,
  ) as StepProgress[];
  // We only show progress at the last step
  // TODO: once we support steps that work in parallel, we need to update this
  const lastProgressStep =
    progressSteps.length > 0
      ? progressSteps[progressSteps.length - 1]
      : undefined;

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
      {textSteps.length > 0 && (
        <div className="flex-1">
          <ul className="list-decimal space-y-2">
            {textSteps.map((step, index) => (
              <li key={index}>
                <TextContent agent={agent} step={step} />
              </li>
            ))}
          </ul>
          {lastProgressStep && !isFinished && (
            <ProgressContent step={lastProgressStep} />
          )}
        </div>
      )}
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

    const eventStep: StepText | StepProgress = event.data
      ? ({
          text: event.text,
          progress: event.data,
        } as StepProgress)
      : ({
          text: event.text,
        } as StepText);

    if (lastMergedEvent && lastMergedEvent.agent === event.agent) {
      lastMergedEvent.steps.push(eventStep);
    } else {
      mergedEvents.push({
        agent: event.agent,
        steps: [eventStep],
        icon: AgentIcons[event.agent.toLowerCase()] ?? icons.Bot,
      });
    }
  }

  return mergedEvents;
}

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

type StepData = {
  text: string;
};

type StepProgress = StepData & {
  progress: ProgressData;
};

type MergedEvent = {
  agent: string;
  icon: LucideIcon;
  steps: Array<StepData | StepProgress>;
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

function TextContent({ agent, steps }: { agent: string; steps: StepData[] }) {
  return (
    <>
      <ul className="flex-1 list-decimal space-y-2">
        {steps.map((step, index) => (
          <li className="whitespace-break-spaces" key={index}>
            {step.text.length <= MAX_TEXT_LENGTH && <span>{step.text}</span>}
            {step.text.length > MAX_TEXT_LENGTH && (
              <div>
                <span>{step.text.slice(0, MAX_TEXT_LENGTH)}...</span>
                <AgentEventDialog
                  content={step.text}
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
  const { agent, steps: allSteps } = event;
  const AgentIcon = event.icon;
  // We only show progress at the last step
  const lastStep =
    allSteps.length > 0 ? allSteps[allSteps.length - 1] : undefined;
  const progressStep =
    lastStep && "progress" in lastStep ? (lastStep as StepProgress) : undefined;
  const steps = allSteps.filter((step) => !("progress" in step));

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
      {steps.length > 0 && (
        <div className="flex-1">
          <TextContent agent={agent} steps={steps} />
          {progressStep && !isFinished && (
            <ProgressContent step={progressStep} />
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

    const eventStep = event.data
      ? {
          text: event.text,
          progress: event.data,
        }
      : {
          text: event.text,
        };

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

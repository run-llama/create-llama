"use client";

import { Message } from "@llamaindex/chat-ui";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock,
  NotebookPen,
  Search,
} from "lucide-react";
import { useMemo } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../collapsible";
import { cn } from "../../lib/utils";
import { Markdown } from "./markdown";

// Streaming event types
type EventState = "pending" | "inprogress" | "done" | "error";

type DeepResearchEvent = {
  type: "deep_research_event";
  data: {
    event: "retrieve" | "analyze" | "answer";
    state: EventState;
    id?: string;
    question?: string;
    answer?: string | null;
  };
};

// UI state types
type QuestionState = {
  id: string;
  question: string;
  answer: string | null;
  state: EventState;
  isOpen: boolean;
};

type DeepResearchCardState = {
  retrieve: {
    state: EventState | null;
  };
  analyze: {
    state: EventState | null;
    questions: QuestionState[];
  };
};

interface DeepResearchCardProps {
  message: Message;
  className?: string;
}

const stateIcon: Record<EventState, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  inprogress: <CircleDashed className="h-4 w-4 text-blue-500 animate-spin" />,
  done: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
};

// Transform the state based on the event without mutations
const transformState = (
  state: DeepResearchCardState,
  event: DeepResearchEvent,
): DeepResearchCardState => {
  switch (event.data.event) {
    case "answer": {
      const { id, question, answer } = event.data;
      if (!id || !question) return state;

      const updatedQuestions = state.analyze.questions.map((q) => {
        if (q.id !== id) return q;
        return {
          ...q,
          state: event.data.state,
          answer: answer ?? q.answer,
        };
      });

      const newQuestion = !state.analyze.questions.some((q) => q.id === id)
        ? [
            {
              id,
              question,
              answer: answer ?? null,
              state: event.data.state,
              isOpen: false,
            },
          ]
        : [];

      return {
        ...state,
        analyze: {
          ...state.analyze,
          questions: [...updatedQuestions, ...newQuestion],
        },
      };
    }

    case "retrieve":
    case "analyze":
      return {
        ...state,
        [event.data.event]: {
          ...state[event.data.event],
          state: event.data.state,
        },
      };

    default:
      return state;
  }
};

// Convert deep research events to state
const deepResearchEventsToState = (
  events: DeepResearchEvent[] | undefined,
): DeepResearchCardState => {
  if (!events?.length) {
    return {
      retrieve: { state: null },
      analyze: { state: null, questions: [] },
    };
  }

  const initialState: DeepResearchCardState = {
    retrieve: { state: null },
    analyze: { state: null, questions: [] },
  };

  return events.reduce(
    (acc: DeepResearchCardState, event: DeepResearchEvent) =>
      transformState(acc, event),
    initialState,
  );
};

export function DeepResearchCard({
  message,
  className,
}: DeepResearchCardProps) {
  const deepResearchEvents = message.annotations as
    | DeepResearchEvent[]
    | undefined;
  const hasDeepResearchEvents = deepResearchEvents?.some(
    (event) => event.type === "deep_research_event",
  );

  const state = useMemo(
    () => deepResearchEventsToState(deepResearchEvents),
    [deepResearchEvents],
  );

  if (!hasDeepResearchEvents) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm p-5 space-y-6 w-full",
        className,
      )}
    >
      {state.retrieve.state !== null && (
        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Search className="h-5 w-5" />
            <span>
              {state.retrieve.state === "inprogress"
                ? "Searching..."
                : "Search completed"}
            </span>
          </h3>
        </div>
      )}

      {state.analyze.state !== null && (
        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <NotebookPen className="h-5 w-5" />
            <span>
              {state.analyze.state === "inprogress"
                ? "Analyzing..."
                : "Analysis"}
            </span>
          </h3>
          {state.analyze.questions.length > 0 && (
            <div className="space-y-2">
              {state.analyze.questions.map((question: QuestionState) => (
                <Collapsible key={question.id}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center gap-2 p-3 hover:bg-accent transition-colors rounded-lg border">
                      <div className="flex-shrink-0">
                        {stateIcon[question.state]}
                      </div>
                      <span className="font-medium text-left flex-1">
                        {question.question}
                      </span>
                      <ChevronDown className="h-5 w-5 transition-transform ui-expanded:rotate-180" />
                    </div>
                  </CollapsibleTrigger>
                  {question.answer && (
                    <CollapsibleContent>
                      <div className="p-3 border border-t-0 rounded-b-lg">
                        <Markdown content={question.answer} />
                      </div>
                    </CollapsibleContent>
                  )}
                </Collapsible>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

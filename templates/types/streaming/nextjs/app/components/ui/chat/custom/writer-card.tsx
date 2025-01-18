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
import { Markdown } from "./markdown";

type EventState = "pending" | "inprogress" | "done" | "error";

type WriterEvent = {
  type: "retrieve" | "analyze" | "answer";
  state: EventState;
  data: {
    id?: string;
    question?: string;
    answer?: string | null;
  };
};

type QuestionState = {
  id: string;
  question: string;
  answer: string | null;
  state: EventState;
  isOpen: boolean;
};

type WriterState = {
  retrieve: {
    state: EventState | null;
  };
  analyze: {
    state: EventState | null;
    questions: QuestionState[];
  };
};

const stateIcon: Record<EventState, React.ReactNode> = {
  pending: <Clock className="w-4 h-4 text-yellow-500" />,
  inprogress: <CircleDashed className="w-4 h-4 text-blue-500 animate-spin" />,
  done: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
};

// Transform the state based on the event without mutations
const transformState = (
  state: WriterState,
  event: WriterEvent,
): WriterState => {
  switch (event.type) {
    case "answer": {
      const { id, question, answer } = event.data;
      if (!id || !question) return state;

      const updatedQuestions = state.analyze.questions.map((q) => {
        if (q.id !== id) return q;
        return {
          ...q,
          state: event.state,
          answer: answer ?? q.answer,
        };
      });

      const newQuestion = !state.analyze.questions.some((q) => q.id === id)
        ? [
            {
              id,
              question,
              answer: answer ?? null,
              state: event.state,
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
        [event.type]: {
          ...state[event.type],
          state: event.state,
        },
      };

    default:
      return state;
  }
};

// Convert writer events to state
const writeEventsToState = (events: WriterEvent[] | undefined): WriterState => {
  if (!events?.length) {
    return {
      retrieve: { state: null },
      analyze: { state: null, questions: [] },
    };
  }

  const initialState: WriterState = {
    retrieve: { state: null },
    analyze: { state: null, questions: [] },
  };

  return events.reduce(
    (acc: WriterState, event: WriterEvent) => transformState(acc, event),
    initialState,
  );
};

export function WriterCard({ message }: { message: Message }) {
  const writerEvents = message.annotations as WriterEvent[] | undefined;

  const state = useMemo(() => writeEventsToState(writerEvents), [writerEvents]);

  if (!writerEvents?.length) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-5 space-y-6 text-gray-800 w-full">
      {state.retrieve.state !== null && (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
            <Search className="w-5 h-5" />
            <span>
              {state.retrieve.state === "inprogress"
                ? "Searching..."
                : "Search completed"}
            </span>
          </h3>
        </div>
      )}

      {state.analyze.state !== null && (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
            <NotebookPen className="w-5 h-5" />
            <span>
              {state.analyze.state === "inprogress"
                ? "Analyzing..."
                : "Analysis"}
            </span>
          </h3>
          {state.analyze.questions.length > 0 && (
            <div className="space-y-2">
              {state.analyze.questions.map((question) => (
                <Collapsible key={question.id}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors rounded-lg border border-gray-200">
                      <div className="flex-shrink-0">
                        {stateIcon[question.state]}
                      </div>
                      <span className="font-medium text-left flex-1">
                        {question.question}
                      </span>
                      <ChevronDown className="w-5 h-5 transition-transform ui-expanded:rotate-180" />
                    </div>
                  </CollapsibleTrigger>
                  {question.answer && (
                    <CollapsibleContent>
                      <div className="p-3 border border-t-0 border-gray-200 rounded-b-lg">
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

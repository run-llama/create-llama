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
import { useEffect, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../collapsible";

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

// Update the state based on the event
const updateState = (state: WriterState, event: WriterEvent): WriterState => {
  switch (event.type) {
    case "answer": {
      const { id, question, answer } = event.data;
      if (!id || !question) return state;

      const questions = state.analyze.questions;
      const existingQuestion = questions.find((q) => q.id === id);

      const updatedQuestions = existingQuestion
        ? questions.map((q) =>
            q.id === id
              ? {
                  ...existingQuestion,
                  state: event.state,
                  answer: answer || existingQuestion.answer,
                }
              : q,
          )
        : [
            ...questions,
            {
              id,
              question,
              answer: answer || null,
              state: event.state,
              isOpen: false,
            },
          ];

      return {
        ...state,
        analyze: {
          ...state.analyze,
          questions: updatedQuestions,
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

export function WriterCard({ message }: { message: Message }) {
  const [state, setState] = useState<WriterState>({
    retrieve: { state: null },
    analyze: { state: null, questions: [] },
  });

  const writerEvents = message.annotations as WriterEvent[] | undefined;

  useEffect(() => {
    if (writerEvents?.length) {
      writerEvents.forEach((event) => {
        setState((currentState) => updateState(currentState, event));
      });
    }
  }, [writerEvents]);

  const getStateIcon = (state: EventState | null) => {
    switch (state) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "inprogress":
        return <CircleDashed className="w-4 h-4 text-blue-500 animate-spin" />;
      case "done":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

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
                        {getStateIcon(question.state)}
                      </div>
                      <span className="font-medium text-left flex-1">
                        {question.question}
                      </span>
                      <ChevronDown className="w-5 h-5 transition-transform ui-expanded:rotate-180" />
                    </div>
                  </CollapsibleTrigger>
                  {question.answer && (
                    <CollapsibleContent>
                      <div className="p-3 text-gray-600 text-left border border-t-0 border-gray-200 rounded-b-lg">
                        {question.answer}
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

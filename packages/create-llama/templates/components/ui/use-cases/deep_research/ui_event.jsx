import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Markdown } from "@llamaindex/chat-ui/widgets";
import {
  AlertCircle,
  Brain,
  CheckCircle,
  Clock,
  Database,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function Component({ events }) {
  const aggregateEvents = (events) => {
    if (!events || events.length === 0)
      return { retrieve: null, analyze: null, answers: [] };

    // Initialize the result structure
    const result = {
      retrieve: null,
      analyze: null,
      answers: [],
    };

    // Process each event
    events.forEach((event) => {
      const { event: eventType, state, id, question, answer } = event;

      if (eventType === "retrieve") {
        // Update retrieve status
        result.retrieve = { state };
      } else if (eventType === "analyze") {
        // Update analyze status
        result.analyze = { state };
      } else if (eventType === "answer" && id) {
        // Find existing answer with the same id or create a new one
        const existingAnswerIndex = result.answers.findIndex(
          (a) => a.id === id,
        );

        if (existingAnswerIndex >= 0) {
          // Update existing answer
          result.answers[existingAnswerIndex] = {
            ...result.answers[existingAnswerIndex],
            state,
            question: question || result.answers[existingAnswerIndex].question,
            answer: answer || result.answers[existingAnswerIndex].answer,
          };
        } else {
          // Add new answer
          result.answers.push({
            id,
            state,
            question,
            answer,
          });
        }
      }
    });

    return result;
  };

  const [aggregatedEvents, setAggregatedEvents] = useState({
    retrieve: null,
    analyze: null,
    answers: [],
  });

  useEffect(() => {
    setAggregatedEvents(aggregateEvents(events));
  }, [events]);

  const { retrieve, analyze, answers } = aggregatedEvents;

  // Helper function to get status icon
  const getStatusIcon = (state) => {
    switch (state) {
      case "pending":
        return <Clock className="h-4 w-4 text-gray-400" />;
      case "inprogress":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "done":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  // Helper function to get status text
  const getStatusText = (state) => {
    switch (state) {
      case "pending":
        return "Pending";
      case "inprogress":
        return "In Progress";
      case "done":
        return "Complete";
      case "error":
        return "Error";
      default:
        return "";
    }
  };

  // Helper function to get status color class
  const getStatusColorClass = (state) => {
    switch (state) {
      case "pending":
        return "bg-gray-200";
      case "inprogress":
        return "bg-blue-500";
      case "done":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-200";
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">DeepResearch Workflow</h1>
        <div className="flex items-center space-x-2">
          <Badge
            variant={retrieve?.state === "done" ? "default" : "outline"}
            className={cn(
              "transition-all",
              retrieve?.state === "done" ? "bg-green-500" : "",
            )}
          >
            Retrieve
          </Badge>
          <Separator className="h-4 w-px bg-gray-300" orientation="vertical" />
          <Badge
            variant={analyze?.state === "done" ? "default" : "outline"}
            className={cn(
              "transition-all",
              analyze?.state === "done" ? "bg-green-500" : "",
            )}
          >
            Analyze
          </Badge>
          <Separator className="h-4 w-px bg-gray-300" orientation="vertical" />
          <Badge
            variant={
              answers.length > 0 && answers.every((a) => a.state === "done")
                ? "default"
                : "outline"
            }
            className={cn(
              "transition-all",
              answers.length > 0 && answers.every((a) => a.state === "done")
                ? "bg-green-500"
                : "",
            )}
          >
            Answer
          </Badge>
        </div>
      </div>

      {/* Retrieve Panel */}
      <Card
        className={cn(
          "border-2 transition-all duration-300",
          retrieve?.state === "inprogress"
            ? "border-blue-500 shadow-lg shadow-blue-100"
            : retrieve?.state === "done"
              ? "border-green-500"
              : retrieve?.state === "error"
                ? "border-red-500"
                : "border-gray-200",
        )}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-gray-700" />
              <CardTitle>Retrieve Information</CardTitle>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "flex items-center space-x-1",
                retrieve?.state === "inprogress"
                  ? "text-blue-500"
                  : retrieve?.state === "done"
                    ? "text-green-500"
                    : retrieve?.state === "error"
                      ? "text-red-500"
                      : "text-gray-500",
              )}
            >
              {getStatusIcon(retrieve?.state)}
              <span>{getStatusText(retrieve?.state)}</span>
            </Badge>
          </div>
          <CardDescription>
            Retrieving relevant information from the knowledge base
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Analyze Panel */}
      {retrieve?.state === "done" && (
        <Card
          className={cn(
            "border-2 transition-all duration-300",
            analyze?.state === "inprogress"
              ? "border-blue-500 shadow-lg shadow-blue-100"
              : analyze?.state === "done"
                ? "border-green-500"
                : analyze?.state === "error"
                  ? "border-red-500"
                  : "border-gray-200",
          )}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-gray-700" />
                <CardTitle>Analyze Information</CardTitle>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "flex items-center space-x-1",
                  analyze?.state === "inprogress"
                    ? "text-blue-500"
                    : analyze?.state === "done"
                      ? "text-green-500"
                      : analyze?.state === "error"
                        ? "text-red-500"
                        : "text-gray-500",
                )}
              >
                {getStatusIcon(analyze?.state)}
                <span>{getStatusText(analyze?.state)}</span>
              </Badge>
            </div>
            <CardDescription>
              Analyzing retrieved information and generating questions
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Answer Panel */}
      {analyze?.state === "done" && answers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-gray-700" />
              <CardTitle>Answers</CardTitle>
            </div>
            <CardDescription>
              Detailed answers to the generated questions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {answers.map((answer, index) => (
                <AccordionItem
                  key={answer.id}
                  value={answer.id}
                  className={cn(
                    "mb-4 overflow-hidden rounded-lg border",
                    answer.state === "inprogress"
                      ? "border-blue-500 shadow-sm shadow-blue-100"
                      : answer.state === "done"
                        ? "border-green-100"
                        : answer.state === "error"
                          ? "border-red-100"
                          : "border-gray-200",
                  )}
                >
                  <AccordionTrigger className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-center space-x-3 text-left">
                      <Badge className="shrink-0 bg-gray-700 text-white">
                        Q{index + 1}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium">{answer.question}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "ml-auto flex shrink-0 items-center space-x-1",
                          answer.state === "inprogress"
                            ? "text-blue-500"
                            : answer.state === "done"
                              ? "text-green-500"
                              : answer.state === "error"
                                ? "text-red-500"
                                : "text-gray-500",
                        )}
                      >
                        {getStatusIcon(answer.state)}
                        <span>{getStatusText(answer.state)}</span>
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-1">
                    <div
                      className={cn(
                        "rounded-md p-3",
                        answer.state === "done"
                          ? "bg-green-50"
                          : answer.state === "inprogress"
                            ? "bg-blue-50"
                            : "bg-gray-50",
                      )}
                    >
                      {answer.answer ? (
                        <Markdown content={answer.answer} />
                      ) : (
                        <div className="flex items-center justify-center p-4 text-gray-500">
                          {answer.state === "inprogress" ? (
                            <div className="flex items-center space-x-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Generating answer...</span>
                            </div>
                          ) : (
                            <span>Waiting for answer</span>
                          )}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="text-sm text-gray-500">
              {answers.filter((a) => a.state === "done").length} of{" "}
              {answers.length} questions answered
            </div>
            <Progress
              value={
                (answers.filter((a) => a.state === "done").length /
                  answers.length) *
                100
              }
              className="h-2 w-1/3 bg-gray-200"
            />
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

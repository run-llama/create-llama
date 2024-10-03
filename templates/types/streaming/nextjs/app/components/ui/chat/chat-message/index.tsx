import { Check, Copy } from "lucide-react";

import { Message } from "ai";
import { Fragment } from "react";
import { Button } from "../../button";
import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard";
import {
  AgentEventData,
  ChatHandler,
  DocumentFileData,
  EventData,
  ImageData,
  MessageAnnotation,
  MessageAnnotationType,
  SuggestedQuestionsData,
  ToolData,
  getAnnotationData,
  getSourceAnnotationData,
} from "../index";
import { ChatAgentEvents } from "./chat-agent-events";
import ChatAvatar from "./chat-avatar";
import { ChatEvents } from "./chat-events";
import { ChatFiles } from "./chat-files";
import { ChatImage } from "./chat-image";
import { ChatSources } from "./chat-sources";
import { SuggestedQuestions } from "./chat-suggestedQuestions";
import ChatTools from "./chat-tools";
import Markdown from "./markdown";

type ContentDisplayConfig = {
  order: number;
  component: JSX.Element | null;
};

function ChatMessageContent({
  message,
  isLoading,
  append,
  isLastMessage,
  artifactVersion,
}: {
  message: Message;
  isLoading: boolean;
  append: Pick<ChatHandler, "append">["append"];
  isLastMessage: boolean;
  artifactVersion: number | undefined;
}) {
  const annotations = message.annotations as MessageAnnotation[] | undefined;
  if (!annotations?.length) return <Markdown content={message.content} />;

  const imageData = getAnnotationData<ImageData>(
    annotations,
    MessageAnnotationType.IMAGE,
  );
  const contentFileData = getAnnotationData<DocumentFileData>(
    annotations,
    MessageAnnotationType.DOCUMENT_FILE,
  );
  const eventData = getAnnotationData<EventData>(
    annotations,
    MessageAnnotationType.EVENTS,
  );
  const agentEventData = getAnnotationData<AgentEventData>(
    annotations,
    MessageAnnotationType.AGENT_EVENTS,
  );

  const sourceData = getSourceAnnotationData(annotations);

  const toolData = getAnnotationData<ToolData>(
    annotations,
    MessageAnnotationType.TOOLS,
  );
  const suggestedQuestionsData = getAnnotationData<SuggestedQuestionsData>(
    annotations,
    MessageAnnotationType.SUGGESTED_QUESTIONS,
  );

  const contents: ContentDisplayConfig[] = [
    {
      order: 1,
      component: imageData[0] ? <ChatImage data={imageData[0]} /> : null,
    },
    {
      order: -3,
      component:
        eventData.length > 0 ? (
          <ChatEvents isLoading={isLoading} data={eventData} />
        ) : null,
    },
    {
      order: -2,
      component:
        agentEventData.length > 0 ? (
          <ChatAgentEvents
            data={agentEventData}
            isFinished={!!message.content}
          />
        ) : null,
    },
    {
      order: 2,
      component: contentFileData[0] ? (
        <ChatFiles data={contentFileData[0]} />
      ) : null,
    },
    {
      order: -1,
      component: toolData[0] ? (
        <ChatTools data={toolData[0]} artifactVersion={artifactVersion} />
      ) : null,
    },
    {
      order: 0,
      component: <Markdown content={message.content} sources={sourceData[0]} />,
    },
    {
      order: 3,
      component: sourceData[0] ? <ChatSources data={sourceData[0]} /> : null,
    },
    {
      order: 4,
      component: suggestedQuestionsData[0] ? (
        <SuggestedQuestions
          questions={suggestedQuestionsData[0]}
          append={append}
          isLastMessage={isLastMessage}
        />
      ) : null,
    },
  ];

  return (
    <div className="flex-1 gap-4 flex flex-col">
      {contents
        .sort((a, b) => a.order - b.order)
        .map((content, index) => (
          <Fragment key={index}>{content.component}</Fragment>
        ))}
    </div>
  );
}

export default function ChatMessage({
  chatMessage,
  isLoading,
  append,
  isLastMessage,
  artifactVersion,
}: {
  chatMessage: Message;
  isLoading: boolean;
  append: Pick<ChatHandler, "append">["append"];
  isLastMessage: boolean;
  artifactVersion: number | undefined;
}) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 });
  return (
    <div className="flex items-start gap-4 pr-5 pt-5">
      <ChatAvatar role={chatMessage.role} />
      <div className="group flex flex-1 justify-between gap-2">
        <ChatMessageContent
          message={chatMessage}
          isLoading={isLoading}
          append={append}
          isLastMessage={isLastMessage}
          artifactVersion={artifactVersion}
        />
        <Button
          onClick={() => copyToClipboard(chatMessage.content)}
          size="icon"
          variant="ghost"
          className="h-8 w-8 opacity-0 group-hover:opacity-100"
        >
          {isCopied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

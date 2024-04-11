import { Check, Copy } from "lucide-react";

import { Message } from "ai";
import { Fragment } from "react";
import { Button } from "../button";
import ChatAvatar from "./chat-avatar";
import { ChatSources } from "./chat-document";
import { ChatImage } from "./chat-image";
import {
  AnnotationData,
  DocumentData,
  ImageData,
  MessageAnotation,
  MessageAnotationType,
} from "./index";
import Markdown from "./markdown";
import { useCopyToClipboard } from "./use-copy-to-clipboard";

type ContentDiplayConfig = {
  order: number;
  component: JSX.Element | null;
};

function getAnnotationData<T extends AnnotationData>(
  annotations: MessageAnotation[],
  type: MessageAnotationType,
): T | undefined {
  return annotations.find((a) => a.type === type)?.data as T | undefined;
}

function ChatMessageContent({ message }: { message: Message }) {
  const annotations = message.annotations as MessageAnotation[] | undefined;
  if (!annotations?.length) return <Markdown content={message.content} />;

  const imageData = getAnnotationData<ImageData>(
    annotations,
    MessageAnotationType.IMAGE,
  );
  const documentData = getAnnotationData<DocumentData>(
    annotations,
    MessageAnotationType.DOCUMENT,
  );

  const contents: ContentDiplayConfig[] = [
    {
      order: -1,
      component: imageData ? <ChatImage data={imageData} /> : null,
    },
    {
      order: 0,
      component: <Markdown content={message.content} />,
    },
    {
      order: 1,
      component: documentData ? <ChatSources data={documentData} /> : null,
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

export default function ChatMessage(chatMessage: Message) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 });
  return (
    <div className="flex items-start gap-4 pr-5 pt-5">
      <ChatAvatar role={chatMessage.role} />
      <div className="group flex flex-1 justify-between gap-2">
        <ChatMessageContent message={chatMessage} />
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

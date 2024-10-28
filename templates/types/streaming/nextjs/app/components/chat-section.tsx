"use client";

import {
  ChatInput,
  ChatMessage,
  ChatMessages,
  ChatSection as ChatSectionUI,
  useChatUI,
  useFile,
} from "@llamaindex/chat-ui";
import { useChat } from "ai/react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import ChatMessageAvatar from "./ui/chat/chat-message/chat-avatar";
import { useClientConfig } from "./ui/chat/hooks/use-config";
import { LlamaCloudSelector } from "./ui/chat/widgets/LlamaCloudSelector";
import { DocumentPreview } from "./ui/document-preview";
import UploadImagePreview from "./ui/upload-image-preview";

export default function ChatSection() {
  const { backend } = useClientConfig();
  const handler = useChat({
    api: `${backend}/api/chat`,
    onError: (error: unknown) => {
      if (!(error instanceof Error)) throw error;
      alert(JSON.parse(error.message).detail);
    },
  });
  return (
    <ChatSectionUI handler={handler} className="w-full h-full">
      <ChatMessages className="shadow-xl rounded-xl">
        <ChatMessages.List>
          {handler.messages.map((message) => (
            <ChatMessage key={message.id} message={message}>
              <ChatMessageAvatar />
              <ChatMessage.Content />
              {/* TODO: handle ChatMessage content and artifact */}
              <ChatMessage.Actions />
            </ChatMessage>
          ))}
          <ChatMessages.Loading />
        </ChatMessages.List>
        <ChatMessages.Actions />
        <StarterQuestions />
      </ChatMessages>
      <CustomChatInput />
    </ChatSectionUI>
  );
}

// TODO: replace old ChatInput component
function CustomChatInput() {
  const { requestData } = useChatUI();
  const { backend } = useClientConfig();
  const {
    imageUrl,
    setImageUrl,
    uploadFile,
    files,
    removeDoc,
    reset,
    getAnnotations,
  } = useFile({ uploadAPI: `${backend}/api/chat/upload` });

  const handleUploadFile = async (file: File) => {
    if (imageUrl) {
      alert("You can only upload one image at a time.");
      return;
    }
    try {
      await uploadFile(file, requestData);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const annotations = getAnnotations();

  return (
    <ChatInput
      className="shadow-xl rounded-xl"
      resetUploadedFiles={reset}
      annotations={annotations}
    >
      <ChatInput.Preview />
      <div>
        {imageUrl && (
          <UploadImagePreview
            url={imageUrl}
            onRemove={() => setImageUrl(null)}
          />
        )}
        {files.length > 0 && (
          <div className="flex gap-4 w-full overflow-auto py-2">
            {files.map((file) => (
              <DocumentPreview
                key={file.id}
                file={file}
                onRemove={() => removeDoc(file)}
              />
            ))}
          </div>
        )}
      </div>
      <ChatInput.Form>
        <ChatInput.Field />
        <ChatInput.Upload onUpload={handleUploadFile} />
        <LlamaCloudSelector />
        <ChatInput.Submit />
      </ChatInput.Form>
    </ChatInput>
  );
}

// TODO: extract a component or move to CustomChatMessages
function StarterQuestions() {
  const { backend } = useClientConfig();
  const { append } = useChatUI();
  const [starterQuestions, setStarterQuestions] = useState<string[]>();

  useEffect(() => {
    if (!starterQuestions) {
      fetch(`${backend}/api/chat/config`)
        .then((response) => response.json())
        .then((data) => {
          if (data?.starterQuestions) {
            setStarterQuestions(data.starterQuestions);
          }
        })
        .catch((error) => console.error("Error fetching config", error));
    }
  }, [starterQuestions, backend]);

  if (!starterQuestions?.length) return null;

  return (
    <div className="absolute bottom-6 left-0 w-full">
      <div className="grid grid-cols-2 gap-2 mx-20">
        {starterQuestions.map((question, i) => (
          <Button
            key={i}
            variant="outline"
            onClick={() => append({ role: "user", content: question })}
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}

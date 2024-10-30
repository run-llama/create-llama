"use client";

import {
  ChatInput,
  DocumentPreview,
  ImagePreview,
  useChatUI,
  useFile,
} from "@llamaindex/chat-ui";
import { useClientConfig } from "./hooks/use-config";
import { LlamaCloudSelector } from "./widgets/LlamaCloudSelector";

export default function CustomChatInput() {
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
      <div>
        {imageUrl && (
          <ImagePreview url={imageUrl} onRemove={() => setImageUrl(null)} />
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

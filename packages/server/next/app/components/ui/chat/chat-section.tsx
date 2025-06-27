"use client";

import { ChatSection as ChatUI, useChatWorkflow } from "@llamaindex/chat-ui";
import { useChat } from "ai/react";
import { useEffect, useMemo, useState } from "react";
import { getConfig } from "../lib/utils";
import { ResizablePanel, ResizablePanelGroup } from "../resizable";
import { ChatCanvasPanel } from "./canvas/panel";
import { ChatInjection } from "./chat-injection";
import CustomChatInput from "./chat-input";
import CustomChatMessages from "./chat-messages";
import { DynamicEventsErrors } from "./custom/events/dynamic-events-errors";
import { fetchComponentDefinitions } from "./custom/events/loader";
import { ComponentDef } from "./custom/events/types";
import { DevModePanel } from "./dev-mode-panel";
import { ChatLayout } from "./layout";

export default function ChatSection() {
  const shouldUseChatWorkflow = getConfig("USE_CHAT_WORKFLOW") === "true";
  const deployment = getConfig("CHAT_DEPLOYMENT") || "";
  const workflow = getConfig("CHAT_WORKFLOW") || "";

  const onError = (error: unknown) => {
    if (!(error instanceof Error)) throw error;
    let errorMessage: string;
    try {
      errorMessage = JSON.parse(error.message).detail;
    } catch (e) {
      errorMessage = error.message;
    }
    alert(errorMessage);
  };

  const useChatHandler = useChat({
    api: getConfig("CHAT_API") || "/api/chat",
    onError,
    experimental_throttle: 100,
  });

  const useChatWorkflowHandler = useChatWorkflow({
    deployment,
    workflow,
    onError,
  });

  const handler = shouldUseChatWorkflow
    ? useChatWorkflowHandler
    : useChatHandler;

  if (shouldUseChatWorkflow && (!deployment || !workflow)) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
        <p>
          CHAT_DEPLOYMENT and CHAT_WORKFLOW are required when using
          useChatWorkflow. Please set them in frontend config file.
        </p>
      </div>
    );
  }

  return (
    <>
      <ChatLayout>
        <ChatUI
          handler={handler}
          className="relative flex min-h-0 flex-1 flex-row justify-center gap-4 px-4 py-0"
        >
          <ResizablePanelGroup direction="horizontal">
            <ChatSectionPanel />
            <ChatCanvasPanel />
          </ResizablePanelGroup>
          <DevModePanel />
        </ChatUI>
      </ChatLayout>
      <ChatInjection />
    </>
  );
}

function ChatSectionPanel() {
  const [componentDefs, setComponentDefs] = useState<ComponentDef[]>([]);
  const [dynamicEventsErrors, setDynamicEventsErrors] = useState<string[]>([]); // contain all errors when rendering dynamic events from componentDir

  const appendError = (error: string) => {
    setDynamicEventsErrors((prev) => [...prev, error]);
  };

  const uniqueErrors = useMemo(() => {
    return Array.from(new Set(dynamicEventsErrors));
  }, [dynamicEventsErrors]);

  // fetch component definitions and use Babel to tranform JSX code to JS code
  // this is triggered only once when the page is initialised
  useEffect(() => {
    fetchComponentDefinitions().then(({ components, errors }) => {
      setComponentDefs(components);
      if (errors.length > 0) {
        setDynamicEventsErrors((prev) => [...prev, ...errors]);
      }
    });
  }, []);

  return (
    <ResizablePanel defaultSize={40} minSize={30} className="max-w-1/2 mx-auto">
      <div className="flex h-full min-w-0 flex-1 flex-col gap-4">
        <DynamicEventsErrors
          errors={uniqueErrors}
          clearErrors={() => setDynamicEventsErrors([])}
        />
        <CustomChatMessages
          componentDefs={componentDefs}
          appendError={appendError}
        />
        <CustomChatInput />
      </div>
    </ResizablePanel>
  );
}

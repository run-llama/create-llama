"use client";

import { CodeEditor } from "@llamaindex/chat-ui/widgets";
import { useEffect, useState } from "react";
import { Button } from "../button";

// TODO: show/hide by DEV_MODE in config.js
export function DevModePanel() {
  const [devModeOpen, setDevModeOpen] = useState(false);

  // TODO: show loading from isFetching
  const [isFetching, setIsFetching] = useState(false);
  const [workflowFile, setWorkflowFile] = useState<{
    last_modified: number;
    file_name: string;
    content: string;
  } | null>(null);

  const [updatedCode, setUpdatedCode] = useState("");

  const handleResetCode = () => {
    setUpdatedCode(workflowFile?.content ?? "");
  };

  const handleSaveCode = async () => {
    // TODO: toast promise
    await fetch("/files/workflow", {
      method: "PUT",
      body: JSON.stringify({
        content: updatedCode,
      }),
    });
  };

  useEffect(() => {
    async function fetchWorkflowCode() {
      try {
        setIsFetching(true);
        const response = await fetch("/files/workflow");
        const data = await response.json();
        setWorkflowFile(data);
      } catch (error) {
        // TODO: use toast
        console.error("Error fetching workflow code:", error);
      } finally {
        setIsFetching(false);
      }
    }

    fetchWorkflowCode();
  }, []);

  return (
    <>
      <Button
        onClick={() => setDevModeOpen(!devModeOpen)}
        className="fixed right-2 top-1/2 origin-right -translate-y-1/2 rotate-90 transform rounded-l-md shadow-md transition-transform hover:-translate-x-1"
      >
        Dev Mode
      </Button>
      <div
        className={`bg-background border-border fixed right-0 top-0 h-full w-[800px] border-l shadow-xl transition-transform duration-300 ease-in-out ${
          devModeOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Workflow Editor</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDevModeOpen(false)}
            >
              Close
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            <CodeEditor code={updatedCode} onChange={setUpdatedCode} />
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              className="mr-2"
              onClick={handleResetCode}
            >
              Reset Code
            </Button>
            <Button onClick={handleSaveCode}>Save & Restart Server</Button>
          </div>
        </div>
      </div>
    </>
  );
}

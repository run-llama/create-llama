"use client";

import {
  CodeEditor,
  fileExtensionToEditorLang,
} from "@llamaindex/chat-ui/widgets";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../button";
import { getConfig } from "../lib/utils";

const API_PATH = "/api/dev/files/workflow";
const POLLING_TIMEOUT = 30_000; // 30 seconds

type WorkflowFile = {
  last_modified: number;
  file_path: string;
  content: string;
};

export function DevModePanel() {
  const devModeEnabled =
    getConfig("DEV_MODE") ?? process.env.NEXT_PUBLIC_DEV_MODE === "true";
  if (!devModeEnabled) return null;
  return <DevModePanelComp />;
}

function DevModePanelComp() {
  const [devModeOpen, setDevModeOpen] = useState(false);

  const [isFetching, setIsFetching] = useState(false);
  const [fetchingError, setFetchingError] = useState<string | null>();
  const [workflowFile, setWorkflowFile] = useState<WorkflowFile | null>(null);

  const [updatedCode, setUpdatedCode] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isPolling, setIsPolling] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);

  async function fetchWorkflowCode() {
    try {
      setIsFetching(true);
      const response = await fetch(API_PATH);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail ?? "Unknown error");
      }

      setWorkflowFile(data);
      setFetchingError(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setFetchingError(errorMessage);
      console.warn("Error fetching workflow code:", error);
    } finally {
      setIsFetching(false);
    }
  }

  async function restartingWorkflow() {
    if (!workflowFile) return;

    const initialLastModified = workflowFile.last_modified;
    setIsPolling(true);
    setPollingError(null);

    const pollStartTime = Date.now();

    // interval refetching the updated workflow code
    const poll = async () => {
      if (Date.now() - pollStartTime > POLLING_TIMEOUT) {
        setPollingError(
          `Server not responding after ${POLLING_TIMEOUT / 1000} seconds.`,
        );
        return;
      }

      try {
        const pollResponse = await fetch(API_PATH);
        const pollData = (await pollResponse.json()) as WorkflowFile;
        if (pollData.last_modified !== initialLastModified) {
          setWorkflowFile(pollData);
          setUpdatedCode(pollData.content);
          setIsPolling(false);
          setPollingError(null);
          setDevModeOpen(false);
        } else {
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.info("Polling error", error);
        setTimeout(poll, 2000);
      }
    };

    setTimeout(poll, 2000);
  }

  const handleResetCode = () => {
    setUpdatedCode(workflowFile?.content ?? null);
    setSaveError(null);
  };

  const handleSaveCode = async () => {
    if (!workflowFile) return;

    try {
      setIsSaving(true);
      const response = await fetch(API_PATH, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: updatedCode,
          file_path: workflowFile.file_path,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail ?? "Unknown error");
      }
      setSaveError(null);
      await restartingWorkflow();
    } catch (error) {
      console.warn("Error saving workflow code:", error);
      setSaveError(
        error instanceof Error
          ? error.message
          : "Unknown error happened when saving workflow code",
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (devModeOpen) {
      fetchWorkflowCode();
    }
  }, [devModeOpen]);

  const codeEditorLanguage = useMemo(() => {
    if (!workflowFile?.file_path) return undefined;
    return fileExtensionToEditorLang(
      workflowFile.file_path.split(".").pop() ?? "",
    );
  }, [workflowFile]);

  return (
    <>
      <Button
        onClick={() => setDevModeOpen(!devModeOpen)}
        className="fixed right-2 top-1/2 origin-right -translate-y-1/2 rotate-90 transform rounded-l-md shadow-md transition-transform hover:-translate-x-1"
      >
        Dev Mode
      </Button>

      {isPolling && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          {!pollingError && (
            <>
              <Loader2 className="mb-4 h-16 w-16 animate-spin text-white" />
              <p className="text-lg font-semibold text-white">
                Applying changes and restarting server...
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Please wait for a while then you can start chatting with the
                updated workflow.
              </p>
            </>
          )}
          {pollingError && (
            <div className="bg-destructive/20 text-destructive-foreground mt-4 max-w-md rounded-md p-4 text-center">
              <div className="mb-2 flex items-center justify-center gap-2">
                <AlertCircle className="shrink-0" size={16} />
                <h6 className="text-sm font-medium">Server Starting Error</h6>
              </div>
              <p className="text-sm">{pollingError}</p>

              <p className="text-sm">
                Please reload the page and check server logs.
              </p>
            </div>
          )}
        </div>
      )}

      <div
        className={`border-border fixed right-0 top-0 z-10 h-full w-full border-l shadow-xl transition-all duration-300 ease-in-out ${
          devModeOpen ? "translate-x-0 bg-black/50" : "translate-x-full"
        }`}
        onClick={() => setDevModeOpen(false)}
      >
        <div
          className={`bg-background ml-auto flex h-full w-[800px] flex-col p-4`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Workflow Editor</h2>
              <p className="text-muted-foreground text-sm">
                {isFetching ? (
                  "Loading..."
                ) : workflowFile ? (
                  <>
                    Edit the code of <b>{workflowFile.file_path}</b> and save to
                    apply changes to your workflow.
                  </>
                ) : (
                  ""
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDevModeOpen(false)}
            >
              Close
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            {fetchingError ? (
              <div className="bg-destructive/10 text-destructive/70 mb-4 flex items-center gap-2 rounded-md p-4">
                <AlertCircle className="shrink-0" size={16} />
                <p className="text-sm font-medium">{fetchingError}</p>
              </div>
            ) : (
              <CodeEditor
                code={updatedCode ?? workflowFile?.content ?? ""}
                onChange={setUpdatedCode}
                language={codeEditorLanguage}
              />
            )}
          </div>
          <div className="mt-4 flex flex-col">
            {saveError && (
              <div className="bg-destructive/10 text-destructive/70 mb-4 rounded-md p-4">
                <div className="mb-2 flex items-center gap-2">
                  <AlertCircle className="shrink-0" size={16} />
                  <h6 className="text-sm font-medium">Error Saving Code</h6>
                </div>
                <p className="whitespace-pre-wrap text-sm">{saveError}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="mr-2"
                onClick={handleResetCode}
              >
                Reset Code
              </Button>
              <Button
                onClick={handleSaveCode}
                disabled={isSaving || !updatedCode || !workflowFile}
              >
                Save & Restart Server
                {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

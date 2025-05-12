"use client";

import { CodeEditor } from "@llamaindex/chat-ui/widgets";
import { useState } from "react";
import { Button } from "../button";

const code = `
import { LlamaIndexServer } from "@llamaindex/server";
import { agent } from "@llamaindex/workflow";
import { tool } from "llamaindex";
import { z } from "zod";

const calculatorAgent = agent({
  tools: [
    tool({
      name: "add",
      description: "Adds two numbers",
      parameters: z.object({ x: z.number(), y: z.number() }),
      execute: ({ x, y }) => x + y,
    }),
  ],
});

new LlamaIndexServer({
  workflow: () => calculatorAgent,
  uiConfig: {
    appTitle: "Calculator",
    starterQuestions: ["1 + 1", "2 + 2"],
  },
  port: 4000,
}).start();
`;

export function DevModePanel() {
  const [devModeOpen, setDevModeOpen] = useState(false);
  const [updatedCode, setUpdatedCode] = useState(code);

  // TODO: show/hide by DEV_MODE in config.js

  const handleResetCode = () => {
    setUpdatedCode(code);
  };

  const handleSaveCode = () => {
    // trigger API
  };

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

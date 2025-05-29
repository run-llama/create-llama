import { JSONValue, useChatUI } from "@llamaindex/chat-ui";
import React, { FC, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

// Manual type definition to replace zod schema
interface HumanEvent {
  prefix: string;
  event_component?: string;
  command?: string;
}


const CLIHumanInput: FC<{
  events: JSONValue[];
}> = ({ events }) => {
  const aggregateEvents = () => {
    if (!events || events.length === 0) return null;
    return events[events.length - 1];
  };

  const event = aggregateEvents() as unknown as HumanEvent;

  const { append } = useChatUI();
  const [confirmedValue, setConfirmedValue] = useState<boolean | null>(null);

  const handleConfirm = () => {
    append({
      content: "Yes",
      role: "user",
      annotations: [
        {
          type: "human_response",
          data: {
            execute: true,
            command: event.command,
          },
        },
      ],
    });
    setConfirmedValue(true);
  };

  const handleCancel = () => {
    append({
      content: "No",
      role: "user",
      annotations: [
        {
          type: "human_response",
          data: {
            execute: false,
            command: event.command,
          },
        },
      ],
    });
    setConfirmedValue(false);
  };

  return (
    <Card className="my-4">
      <CardContent className="pt-6">
        <p className="text-sm text-gray-700">
          Do you want to execute the following command?
        </p>
        <pre className="bg-gray-100 rounded p-3 my-2 text-xs font-mono text-gray-800 overflow-x-auto">
          {event.command}
        </pre>
      </CardContent>
      {confirmedValue === null ? (
        <CardFooter className="flex justify-end gap-2">
          <>
            <Button onClick={handleConfirm}>Yes</Button>
            <Button onClick={handleCancel}>No</Button>
          </>
        </CardFooter>
      ) : null}
    </Card>
  );
};

export default CLIHumanInput;
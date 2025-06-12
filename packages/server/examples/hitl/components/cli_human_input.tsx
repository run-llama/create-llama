import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { JSONValue, useChatUI } from "@llamaindex/chat-ui";
import React, { FC, useState } from "react";
import { z } from "zod";

// This schema is equivalent to the CLICommand model defined in events.py
const CLIInputEventSchema = z.object({
  command: z.string(),
});
type CLIInputEvent = z.infer<typeof CLIInputEventSchema>;

const CLIHumanInput: FC<{
  events: JSONValue[];
}> = ({ events }) => {
  const inputEvent = (events || [])
    .map((ev) => {
      const parseResult = CLIInputEventSchema.safeParse(ev);
      return parseResult.success ? parseResult.data : null;
    })
    .filter((ev): ev is CLIInputEvent => ev !== null)
    .at(-1);

  const { append } = useChatUI();
  const [confirmedValue, setConfirmedValue] = useState<boolean | null>(null);
  const [editableCommand, setEditableCommand] = useState<string | undefined>(
    inputEvent?.command,
  );

  // Update editableCommand if inputEvent changes (e.g. new event comes in)
  React.useEffect(() => {
    setEditableCommand(inputEvent?.command);
  }, [inputEvent?.command]);

  const handleConfirm = () => {
    append({
      content: "Yes",
      role: "user",
      annotations: [
        {
          type: "human_response",
          data: {
            execute: true,
            command: editableCommand, // Use editable command
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
            command: inputEvent?.command,
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
        <input
          disabled
          type="text"
          value={editableCommand || ""}
          onChange={(e) => setEditableCommand(e.target.value)}
          className="my-2 w-full overflow-x-auto rounded border border-gray-300 bg-gray-100 p-3 font-mono text-xs text-gray-800"
        />
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

import { useChatUI } from "@llamaindex/chat-ui";
import { JSONValue } from "ai";
import { FC, useState } from "react";
import { z } from "zod";
import { Button } from "../../../../../packages/server/next/app/components/ui/button";
import { Card, CardContent, CardFooter } from "../../../../../packages/server/next/app/components/ui/card";

const HumanEventSchema = z.object({
  type: z.literal("human"),
  data: z.object({
    prefix: z.string(),
  }),
});

type HumanEvent = z.infer<typeof HumanEventSchema>;

export const HumanResponse: FC<{
  events: JSONValue[];
}> = ({ events }) => {
  const { append } = useChatUI();
  const [confirmedValue, setConfirmedValue] = useState<boolean | null>(null);

  const humanEvent = events.find((e): e is HumanEvent => {
    try {
      return HumanEventSchema.parse(e) !== null;
    } catch {
      return false;
    }
  });

  if (!humanEvent) return null;

  const handleConfirm = () => {
    append({
      content: "Yes",
      role: "user",
      annotations: [
        {
          type: "human_response",
          data: {
            response: "yes",
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
            response: "no",
          },
        },
      ],
    });
    setConfirmedValue(false);
  };

  return (
    <Card className="my-4">
      <CardContent className="pt-6">
        <p className="text-sm text-gray-700">{humanEvent.data.prefix}</p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        {confirmedValue === null ? (
          <>
            <Button onClick={handleConfirm}>Yes</Button>
            <Button onClick={handleCancel}>No</Button>
          </>
        ) : confirmedValue ? (
          <p className="text-sm text-gray-700">Yes</p>
        ) : (
          <p className="text-sm text-gray-700">No</p>
        )}
      </CardFooter>
    </Card>
  );
};

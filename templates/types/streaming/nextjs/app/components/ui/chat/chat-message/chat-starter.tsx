import { StarterQuestions } from "@llamaindex/chat-ui";
import { useEffect, useState } from "react";
import { useClientConfig } from "./hooks/use-config";

export function ChatStarter() {
  const { backend } = useClientConfig();
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
  return <StarterQuestions questions={starterQuestions} />;
}

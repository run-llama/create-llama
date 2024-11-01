import {
  getAnnotationData,
  MessageAnnotation,
  useChatMessage,
  useChatUI,
} from "@llamaindex/chat-ui";
import { JSONValue, Message } from "ai";
import { useMemo } from "react";
import { Artifact, CodeArtifact } from "./artifact";
import { WeatherCard, WeatherData } from "./weather-card";

export function ToolAnnotations({ message }: { message: Message }) {
  const annotations = message.annotations as MessageAnnotation[] | undefined;
  const toolData = annotations
    ? (getAnnotationData(annotations, "tools") as unknown as ToolData[])
    : null;
  return toolData?.[0] ? <ChatTools data={toolData[0]} /> : null;
}

// TODO: Used to render outputs of tools. If needed, add more renderers here.
function ChatTools({ data }: { data: ToolData }) {
  const { messages } = useChatUI();
  const { message } = useChatMessage();

  // build a map of message id to artifact version
  const artifactVersionMap = useMemo(() => {
    const map = new Map<string, number | undefined>();
    let versionIndex = 1;
    messages.forEach((m) => {
      m.annotations?.forEach((annotation: any) => {
        if (
          typeof annotation === "object" &&
          annotation != null &&
          "type" in annotation &&
          annotation.type === "tools"
        ) {
          const data = annotation.data as ToolData;
          if (data?.toolCall?.name === "artifact") {
            map.set(m.id, versionIndex);
            versionIndex++;
          }
        }
      });
    });
    return map;
  }, [messages]);

  if (!data) return null;
  const { toolCall, toolOutput } = data;

  if (toolOutput.isError) {
    return (
      <div className="border-l-2 border-red-400 pl-2">
        There was an error when calling the tool {toolCall.name} with input:{" "}
        <br />
        {JSON.stringify(toolCall.input)}
      </div>
    );
  }

  switch (toolCall.name) {
    case "get_weather_information":
      const weatherData = toolOutput.output as unknown as WeatherData;
      return <WeatherCard data={weatherData} />;
    case "artifact":
      return (
        <Artifact
          artifact={toolOutput.output as CodeArtifact}
          version={artifactVersionMap.get(message.id)}
        />
      );
    default:
      return null;
  }
}

type ToolData = {
  toolCall: {
    id: string;
    name: string;
    input: {
      [key: string]: JSONValue;
    };
  };
  toolOutput: {
    output: JSONValue;
    isError: boolean;
  };
};

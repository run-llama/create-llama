import { ChatMessage } from "@llamaindex/chat-ui";
import { DeepResearchCard } from "./custom/deep-research-card";
import { ArtifactToolComponent } from "./tools/artifact";
import { ToolAnnotations } from "./tools/chat-tools";
import { ChatSourcesComponent, RetrieverComponent } from "./tools/query-index";
import { WeatherToolComponent } from "./tools/weather-card";
export function ChatMessageContent() {
  return (
    <ChatMessage.Content>
      <ChatMessage.Content.Event />
      <ChatMessage.Content.AgentEvent />
      <RetrieverComponent />
      <WeatherToolComponent />
      <DeepResearchCard />
      {/* For backward compatibility with the events from AgentRunner
       * ToolAnnotations will be removed when we migrate to AgentWorkflow completely
       */}
      <ToolAnnotations />
      <ArtifactToolComponent />
      <ChatMessage.Content.Image />
      <ChatMessage.Content.Markdown />
      <ChatMessage.Content.DocumentFile />
      <ChatSourcesComponent />
      {/* For backward compatibility with the events from AgentRunner.
       * The Source component will be removed when we migrate to AgentWorkflow completely
       */}
      <ChatMessage.Content.Source />
      <ChatMessage.Content.SuggestedQuestions />
    </ChatMessage.Content>
  );
}

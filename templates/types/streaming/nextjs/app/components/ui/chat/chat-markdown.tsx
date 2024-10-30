import { Markdown, SourceData } from "@llamaindex/chat-ui";
import { useClientConfig } from "./hooks/use-config";

const preprocessMedia = (content: string) => {
  // Remove `sandbox:` from the beginning of the URL
  // to fix OpenAI's models issue appending `sandbox:` to the relative URL
  return content.replace(/(sandbox|attachment|snt):/g, "");
};

export function ChatMarkdown({
  content,
  sources,
}: {
  content: string;
  sources?: SourceData;
}) {
  const { backend } = useClientConfig();
  const processedContent = preprocessMedia(content);
  return (
    <Markdown content={processedContent} backend={backend} sources={sources} />
  );
}

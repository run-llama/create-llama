import { agentStreamEvent, type WorkflowEventData } from "@llamaindex/workflow";
import { type ChatMessage } from "llamaindex";
import { z } from "zod";

const INLINE_ANNOTATION_KEY = "annotation"; // the language key to detect inline annotation code in markdown

export const AnnotationSchema = z.object({
  type: z.string(),
  data: z.any(),
});

export type Annotation = z.infer<typeof AnnotationSchema>;

export function getInlineAnnotations(message: ChatMessage): Annotation[] {
  const markdownContent = getMessageMarkdownContent(message);

  const inlineAnnotations: Annotation[] = [];

  // Regex to match annotation code blocks
  // Matches ```annotation followed by content until closing ```
  const annotationRegex = new RegExp(
    `\`\`\`${INLINE_ANNOTATION_KEY}\\s*\\n([\\s\\S]*?)\\n\`\`\``,
    "g",
  );

  let match;
  while ((match = annotationRegex.exec(markdownContent)) !== null) {
    const jsonContent = match[1]?.trim();

    if (!jsonContent) {
      continue;
    }

    try {
      // Parse the JSON content
      const parsed = JSON.parse(jsonContent);

      // Validate against the annotation schema
      const validated = AnnotationSchema.parse(parsed);

      // Extract the artifact data
      inlineAnnotations.push(validated);
    } catch (error) {
      // Skip invalid annotations - they might be malformed JSON or invalid schema
      console.warn("Failed to parse annotation:", error);
    }
  }

  return inlineAnnotations;
}

/**
 * To append inline annotations to the stream, we need to wrap the annotation in a code block with the language key.
 * The language key is `annotation` and the code block is wrapped in backticks.
 *
 * \`\`\`annotation
 * \{
 *   "type": "artifact",
 *   "data": \{...\}
 * \}
 * \`\`\`
 */
export function toInlineAnnotation(item: unknown) {
  return `\n\`\`\`${INLINE_ANNOTATION_KEY}\n${JSON.stringify(item)}\n\`\`\`\n`;
}

export function toInlineAnnotationEvent(event: WorkflowEventData<unknown>) {
  return agentStreamEvent.with({
    delta: toInlineAnnotation(event.data),
    response: "",
    currentAgentName: "assistant",
    raw: event.data,
  });
}

function getMessageMarkdownContent(message: ChatMessage): string {
  let markdownContent = "";

  if (typeof message.content === "string") {
    markdownContent = message.content;
  } else {
    message.content.forEach((item) => {
      if (item.type === "text") {
        markdownContent += item.text;
      }
    });
  }

  return markdownContent;
}

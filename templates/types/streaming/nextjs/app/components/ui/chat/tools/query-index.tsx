"use client";

import {
  getCustomAnnotation,
  SourceNode,
  useChatMessage,
} from "@llamaindex/chat-ui";
import { ChatEvents, ChatSources } from "@llamaindex/chat-ui/widgets";
import { useMemo } from "react";
import { z } from "zod";

const QueryIndexSchema = z.object({
  tool_name: z.literal("query_index"),
  tool_kwargs: z.object({
    input: z.string(),
  }),
  tool_id: z.string(),
  tool_output: z.optional(
    z
      .object({
        content: z.string(),
        tool_name: z.string(),
        raw_input: z.record(z.unknown()),
        raw_output: z.record(z.unknown()),
        is_error: z.boolean().optional(),
      })
      .optional(),
  ),
  return_direct: z.boolean().optional(),
});
type QueryIndex = z.infer<typeof QueryIndexSchema>;

type GroupedIndexQuery = {
  initial: QueryIndex;
  output?: QueryIndex;
};

export function RetrieverComponent() {
  const { message } = useChatMessage();

  const queryIndexEvents = getCustomAnnotation<QueryIndex>(
    message.annotations,
    (annotation) => {
      const result = QueryIndexSchema.safeParse(annotation);
      return result.success;
    },
  );

  // Group events by tool_id and render them in a single ChatEvents component
  const groupedIndexQueries = useMemo(() => {
    const groups = new Map<string, GroupedIndexQuery>();

    queryIndexEvents?.forEach((event) => {
      groups.set(event.tool_id, { initial: event });
    });

    return Array.from(groups.values());
  }, [queryIndexEvents]);

  return (
    <div className="space-y-4">
      {groupedIndexQueries.map(({ initial }) => {
        const eventData = [
          {
            title: `Searching index with query: ${initial.tool_kwargs.input}`,
          },
        ];

        if (initial.tool_output) {
          eventData.push({
            title: `Got ${JSON.stringify((initial.tool_output?.raw_output as any).source_nodes?.length ?? 0)} sources for query: ${initial.tool_kwargs.input}`,
          });
        }

        return (
          <ChatEvents
            key={initial.tool_id}
            data={eventData}
            showLoading={!initial.tool_output}
          />
        );
      })}
    </div>
  );
}

/**
 * Render the source nodes whenever we got query_index tool with output
 */
export function ChatSourcesComponent() {
  const { message } = useChatMessage();

  const queryIndexEvents = getCustomAnnotation<QueryIndex>(
    message.annotations,
    (annotation) => {
      const result = QueryIndexSchema.safeParse(annotation);
      return result.success && !!result.data.tool_output;
    },
  );

  const sources: SourceNode[] = useMemo(() => {
    return (
      queryIndexEvents?.flatMap((event) => {
        const sourceNodes =
          (event.tool_output?.raw_output?.source_nodes as any[]) || [];
        return sourceNodes.map((node) => {
          return {
            id: node.node.id_,
            metadata: node.node.metadata,
            score: node.score,
            text: node.node.text,
            url: node.node.metadata.url,
          };
        });
      }) || []
    );
  }, [queryIndexEvents]);

  return <ChatSources data={{ nodes: sources }} />;
}

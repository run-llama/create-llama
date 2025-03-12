"use client";

import {
  getCustomAnnotation,
  SourceNode,
  useChatMessage,
} from "@llamaindex/chat-ui";
import { ChatEvents, ChatSources } from "@llamaindex/chat-ui/widgets";
import { useMemo } from "react";
import { z } from "zod";

type QueryIndex = {
  toolName: "query_engine";
  toolKwargs: {
    query: string;
  };
  toolId: string;
  toolOutput?: {
    id: string;
    result: string;
    isError: boolean;
  };
  returnDirect: boolean;
};

const TypeScriptSchema = z.object({
  toolName: z.literal("query_engine"),
  toolKwargs: z.object({
    query: z.string(),
  }),
  toolId: z.string(),
  toolOutput: z
    .object({
      id: z.string(),
      result: z.string(),
      isError: z.boolean(),
    })
    .optional(),
  returnDirect: z.boolean(),
});

const PythonSchema = z
  .object({
    tool_name: z.literal("query_engine"),
    tool_kwargs: z.object({
      input: z.string(),
    }),
    tool_id: z.string(),
    tool_output: z
      .object({
        content: z.string(),
        tool_name: z.string(),
        raw_output: z.object({
          source_nodes: z.array(z.any()),
        }),
        is_error: z.boolean().optional(),
      })
      .optional(),
    return_direct: z.boolean().optional(),
  })
  .transform((data): QueryIndex => {
    return {
      toolName: data.tool_name,
      toolKwargs: {
        query: data.tool_kwargs.input,
      },
      toolId: data.tool_id,
      toolOutput: data.tool_output
        ? {
            id: data.tool_id,
            result: data.tool_output.content,
            isError: data.tool_output.is_error || false,
          }
        : undefined,
      returnDirect: data.return_direct || false,
    };
  });

type GroupedIndexQuery = {
  initial: QueryIndex;
  output?: QueryIndex;
};

export function RetrieverComponent() {
  const { message } = useChatMessage();

  const queryIndexEvents = getCustomAnnotation<QueryIndex>(
    message.annotations,
    (annotation) => {
      const schema = "toolName" in annotation ? TypeScriptSchema : PythonSchema;
      const result = schema.safeParse(annotation);
      if (!result.success) return false;

      // If the schema has transformed the annotation, replace the original
      // annotation with the transformed data
      Object.assign(annotation, result.data);
      return true;
    },
  );

  const groupedIndexQueries = useMemo(() => {
    const groups = new Map<string, GroupedIndexQuery>();
    queryIndexEvents?.forEach((event) => {
      groups.set(event.toolId, { initial: event });
    });
    return Array.from(groups.values());
  }, [queryIndexEvents]);

  return (
    groupedIndexQueries.length > 0 && (
      <div className="space-y-4">
        {groupedIndexQueries.map(({ initial }) => {
          const eventData = [
            {
              title: `Searching index with query: ${initial.toolKwargs.query}`,
            },
          ];

          if (initial.toolOutput) {
            eventData.push({
              title: `Got result for query: ${initial.toolKwargs.query}`,
            });
          }

          return (
            <ChatEvents
              key={initial.toolId}
              data={eventData}
              showLoading={!initial.toolOutput}
            />
          );
        })}
      </div>
    )
  );
}

export function ChatSourcesComponent() {
  const { message } = useChatMessage();

  const queryIndexEvents = getCustomAnnotation<QueryIndex>(
    message.annotations,
    (annotation) => {
      const schema = "toolName" in annotation ? TypeScriptSchema : PythonSchema;
      const result = schema.safeParse(annotation);
      if (!result.success) return false;

      // If the schema has transformed the annotation, replace the original
      Object.assign(annotation, result.data);
      return !!result.data.toolOutput;
    },
  );

  const sources: SourceNode[] = useMemo(() => {
    return []; // TypeScript format doesn't use source nodes
  }, [queryIndexEvents]);

  return <ChatSources data={{ nodes: sources }} />;
}

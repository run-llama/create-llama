import { JSONSchemaType } from "ajv";
import { search } from "duck-duck-scrape";
import { BaseTool, ToolMetadata } from "llamaindex";

export type DuckDuckGoParameter = {
  query: string;
  region?: string;
};

export type DuckDuckGoToolParams = {
  metadata?: ToolMetadata<JSONSchemaType<DuckDuckGoParameter>>;
};

const DEFAULT_META_DATA: ToolMetadata<JSONSchemaType<DuckDuckGoParameter>> = {
  name: "duckduckgo",
  description: "Use this function to search for any query in DuckDuckGo.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The query to search in DuckDuckGo.",
      },
      region: {
        type: "string",
        description:
          "Optional, The region to be used for the search in [country-language] convention, ex us-en, uk-en, ru-ru, etc...",
        nullable: true,
      },
    },
    required: ["query"],
  },
};

type DuckDuckGoSearchResult = {
  title: string;
  description: string;
  url: string;
};

export class DuckDuckGoSearchTool implements BaseTool<DuckDuckGoParameter> {
  metadata: ToolMetadata<JSONSchemaType<DuckDuckGoParameter>>;

  constructor(params: DuckDuckGoToolParams) {
    this.metadata = params.metadata ?? DEFAULT_META_DATA;
  }

  async call(input: DuckDuckGoParameter) {
    const { query, region } = input;
    const options = region ? { region } : {};
    const searchResults = await search(query, options);

    return searchResults.results.map((result) => {
      return {
        title: result.title,
        description: result.description,
        url: result.url,
      } as DuckDuckGoSearchResult;
    });
  }
}

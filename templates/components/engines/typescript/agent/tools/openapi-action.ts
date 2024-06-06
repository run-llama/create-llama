import SwaggerParser from "@apidevtools/swagger-parser";
import got from "got";
import { FunctionTool, JSONValue } from "llamaindex";

interface DomainHeaders {
  [key: string]: { [header: string]: string };
}

export class OpenAPIActionToolSpec {
  private readonly INVALID_URL_PROMPT =
    "This url did not include a hostname or scheme. Please determine the complete URL and try again.";

  private readonly LOAD_OPENAPI_SPEC = {
    name: "load_openapi_spec",
    description: "Use this function to load spec first before making requests.",
  } as const;

  private readonly GET_REQUEST_SPEC = {
    name: "get_request",
    description: "Use this to GET content from an url.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The url to make the get request against",
        },
        params: {
          type: "object",
          description: "the parameters to provide with the get request",
        },
      },
      required: ["url"],
    },
  } as const;

  private readonly POST_REQUEST_SPEC = {
    name: "post_request",
    description: "Use this to POST content to an url.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The url to make the get request against",
        },
        data: {
          type: "object",
          description: "the key-value pairs to provide with the get request",
        },
      },
      required: ["url"],
    },
  } as const;

  private readonly PATCH_REQUEST_SPEC = {
    name: "patch_request",
    description: "Use this to PATCH content to an url.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The url to make the get request against",
        },
        data: {
          type: "object",
          description: "the key-value pairs to provide with the get request",
        },
      },
      required: ["url"],
    },
  } as const;

  constructor(
    public openapi_uri: string,
    public domainHeaders: DomainHeaders = {},
  ) {}

  async loadOpenapiSpec(): Promise<any> {
    try {
      const api = (await SwaggerParser.validate(this.openapi_uri)) as any;
      return {
        servers: api.servers,
        description: api.info.description,
        endpoints: api.paths,
      };
    } catch (err) {
      return err;
    }
  }

  async loadOpenapiSpecFromUrl({ url }: { url: string }): Promise<any> {
    try {
      const api = (await SwaggerParser.validate(url)) as any;
      return {
        servers: api.servers,
        description: api.info.description,
        endpoints: api.paths,
      };
    } catch (err) {
      return err;
    }
  }

  async getRequest(input: { url: string; params: object }): Promise<JSONValue> {
    if (!this.validUrl(input.url)) {
      return this.INVALID_URL_PROMPT;
    }
    try {
      const data = await got
        .get(input.url, {
          headers: this.getHeadersForUrl(input.url),
          searchParams: input.params as URLSearchParams,
        })
        .json();
      return data as JSONValue;
    } catch (error) {
      return error as JSONValue;
    }
  }

  async postRequest(input: { url: string; data: object }): Promise<JSONValue> {
    if (!this.validUrl(input.url)) {
      return this.INVALID_URL_PROMPT;
    }
    try {
      const res = await got.post(input.url, {
        headers: this.getHeadersForUrl(input.url),
        json: input.data,
      });
      return res.body as JSONValue;
    } catch (error) {
      return error as JSONValue;
    }
  }

  async patchRequest(input: { url: string; data: object }): Promise<JSONValue> {
    if (!this.validUrl(input.url)) {
      return this.INVALID_URL_PROMPT;
    }
    try {
      const res = await got.patch(input.url, {
        headers: this.getHeadersForUrl(input.url),
        json: input.data,
      });
      return res.body as JSONValue;
    } catch (error) {
      return error as JSONValue;
    }
  }

  public toToolFunctions = () => {
    return [
      FunctionTool.from(() => this.loadOpenapiSpec(), this.LOAD_OPENAPI_SPEC),
      FunctionTool.from(
        (input: { url: string; params: object }) => this.getRequest(input),
        this.GET_REQUEST_SPEC,
      ),
      FunctionTool.from(
        (input: { url: string; data: object }) => this.postRequest(input),
        this.POST_REQUEST_SPEC,
      ),
      FunctionTool.from(
        (input: { url: string; data: object }) => this.patchRequest(input),
        this.PATCH_REQUEST_SPEC,
      ),
    ];
  };

  private validUrl(url: string): boolean {
    const parsed = new URL(url);
    return !!parsed.protocol && !!parsed.hostname;
  }

  private getDomain(url: string): string {
    const parsed = new URL(url);
    return parsed.hostname;
  }

  private getHeadersForUrl(url: string): { [header: string]: string } {
    const domain = this.getDomain(url);
    return this.domainHeaders[domain] || {};
  }
}

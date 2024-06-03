import SwaggerParser from "@apidevtools/swagger-parser";
import axios, { AxiosResponse } from "axios";
import { FunctionTool } from "llamaindex";

interface DomainHeaders {
  [key: string]: { [header: string]: string };
}

export class OpenAPIActionToolSpec {
  private readonly INVALID_URL_PROMPT =
    "This url did not include a hostname or scheme. Please determine the complete URL and try again.";

  private readonly LOAD_OPENAPI_SPEC = {
    name: "load_openapi_spec",
    description:
      "Use this function to load defined spec first before making requests.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the OpenAPI spec",
        },
      },
      required: ["url"],
    },
  } as const;

  private readonly GET_REQUEST_SPEC = {
    name: "get_request",
    description: "Use this to GET content from a website.",
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
    description: "Use this to POST content to a website.",
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
    description: "Use this to PATCH content to a website.",
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

  async loadOpenapiSpec(input: { url: string }): Promise<any> {
    try {
      const api = (await SwaggerParser.validate(input.url)) as any;
      return {
        servers: api.servers,
        description: api.info.description,
        endpoints: api.paths,
      };
    } catch (err) {
      return err;
    }
  }

  async getRequest(input: { url: string; params: object }): Promise<any> {
    if (!this.validUrl(input.url)) {
      return this.INVALID_URL_PROMPT;
    }
    try {
      const res: AxiosResponse = await axios.get(input.url, {
        headers: this.getHeadersForUrl(input.url),
        params: input.params,
      });
      return res.data;
    } catch (error) {
      return error;
    }
  }

  async postRequest(input: { url: string; data: object }): Promise<any> {
    if (!this.validUrl(input.url)) {
      return this.INVALID_URL_PROMPT;
    }
    try {
      const res: AxiosResponse = await axios.post(input.url, input.data, {
        headers: this.getHeadersForUrl(input.url),
      });
      return res.data;
    } catch (error) {
      return error;
    }
  }

  async patchRequest(input: { url: string; data: object }): Promise<any> {
    if (!this.validUrl(input.url)) {
      return this.INVALID_URL_PROMPT;
    }
    try {
      const res = await axios.patch(input.url, input.data, {
        headers: this.getHeadersForUrl(input.url),
      });
      return res.data;
    } catch (error) {
      return error;
    }
  }

  public toToolFunctions = () => {
    return [
      FunctionTool.from(
        (input: { url: string }) => this.loadOpenapiSpec(input),
        this.LOAD_OPENAPI_SPEC,
      ),
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

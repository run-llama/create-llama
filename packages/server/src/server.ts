import { getEnv } from "@llamaindex/env";
import type { Workflow } from "@llamaindex/workflow";
import fs from "fs";
import { createServer } from "http";
import next from "next";
import path from "path";
import { parse } from "url";
import { promisify } from "util";
import { handleChat } from "./handlers/chat";
import type { LlamaIndexServerOptions } from "./types";

const nextDir = path.join(__dirname, "..", "server");
const configFile = path.join(__dirname, "..", "server", "public", "config.js");
const dev = process.env.NODE_ENV !== "production";

export class LlamaIndexServer {
  port: number;
  app: ReturnType<typeof next>;
  workflowFactory: () => Promise<Workflow> | Workflow;
  componentsDir?: string | undefined;
  layoutDir: string;
  suggestNextQuestions: boolean;

  constructor(options: LlamaIndexServerOptions) {
    const { workflow, suggestNextQuestions, ...nextAppOptions } = options;
    this.app = next({ dev, dir: nextDir, ...nextAppOptions });
    this.port = nextAppOptions.port ?? parseInt(process.env.PORT || "3000", 10);
    this.workflowFactory = workflow;
    this.componentsDir = options.uiConfig?.componentsDir;
    this.layoutDir = options.uiConfig?.layoutDir ?? "layout";
    this.suggestNextQuestions = suggestNextQuestions ?? true;

    if (this.componentsDir) {
      this.createComponentsDir(this.componentsDir);
    }

    this.modifyConfig(options);
  }

  private modifyConfig(options: LlamaIndexServerOptions) {
    const { uiConfig } = options;
    const starterQuestions = uiConfig?.starterQuestions ?? [];
    const llamaCloudApi =
      uiConfig?.llamaCloudIndexSelector && getEnv("LLAMA_CLOUD_API_KEY")
        ? "/api/chat/config/llamacloud"
        : undefined;
    const componentsApi = this.componentsDir ? "/api/components" : undefined;
    const layoutApi = this.layoutDir ? "/api/layout" : undefined;
    const devMode = uiConfig?.devMode ?? false;
    const enableFileUpload = uiConfig?.enableFileUpload ?? false;
    // content in javascript format
    const content = `
      window.LLAMAINDEX = {
        CHAT_API: '/api/chat',
        LLAMA_CLOUD_API: ${JSON.stringify(llamaCloudApi)},
        STARTER_QUESTIONS: ${JSON.stringify(starterQuestions)},
        COMPONENTS_API: ${JSON.stringify(componentsApi)},
        LAYOUT_API: ${JSON.stringify(layoutApi)},
        DEV_MODE: ${JSON.stringify(devMode)},
        SUGGEST_NEXT_QUESTIONS: ${JSON.stringify(this.suggestNextQuestions)},
        UPLOAD_API: ${JSON.stringify(enableFileUpload ? "/api/files" : undefined)}
      }
    `;
    fs.writeFileSync(configFile, content);
  }

  private async createComponentsDir(componentsDir: string) {
    const exists = await promisify(fs.exists)(componentsDir);
    if (!exists) {
      await promisify(fs.mkdir)(componentsDir);
    }
  }

  async start() {
    await this.app.prepare();

    const server = createServer((req, res) => {
      const parsedUrl = parse(req.url!, true);
      const pathname = parsedUrl.pathname;
      const query = parsedUrl.query;

      if (pathname === "/api/chat" && req.method === "POST") {
        // because of https://github.com/vercel/next.js/discussions/79402 we can't use route.ts here, so we need to call this custom route
        // when calling `pnpm eject`, the user will get an equivalent route at [path to chat route.ts]
        // make sure to keep its semantic in sync with handleChat
        return handleChat(
          req,
          res,
          this.workflowFactory,
          this.suggestNextQuestions,
        );
      }

      if (
        this.componentsDir &&
        pathname === "/api/components" &&
        req.method === "GET"
      ) {
        query.componentsDir = this.componentsDir;
      }

      if (pathname === "/api/layout" && req.method === "GET") {
        query.layoutDir = this.layoutDir;
      }

      const handle = this.app.getRequestHandler();
      handle(req, res, { ...parsedUrl, query });
    });

    server.listen(this.port, () => {
      console.log(`> Server listening at http://localhost:${this.port}`);
    });
  }
}

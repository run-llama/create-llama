import { getEnv } from "@llamaindex/env";
import type { Workflow } from "@llamaindex/workflow";
import fs from "fs";
import { createServer } from "http";
import next from "next";
import path from "path";
import { parse } from "url";
import { promisify } from "util";
import type { LlamaIndexServerOptions } from "./types";

const nextDir = path.join(__dirname, "..", "server");
const configFile = path.join(__dirname, "..", "server", "public", "config.js");
const dev = process.env.NODE_ENV !== "production";

export class LlamaIndexServer {
  port: number;
  app: ReturnType<typeof next>;
  workflowFactory: () => Promise<Workflow> | Workflow;
  componentsDir?: string | undefined;

  constructor(options: LlamaIndexServerOptions) {
    const { workflow, ...nextAppOptions } = options;
    this.app = next({ dev, dir: nextDir, ...nextAppOptions });
    this.port = nextAppOptions.port ?? parseInt(process.env.PORT || "3000", 10);
    this.workflowFactory = workflow;
    this.componentsDir = options.uiConfig?.componentsDir;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).serverOptions = options;

    if (this.componentsDir) {
      this.createComponentsDir(this.componentsDir);
    }

    this.modifyConfig(options);
  }

  private modifyConfig(options: LlamaIndexServerOptions) {
    const { uiConfig } = options;
    const appTitle = uiConfig?.appTitle ?? "LlamaIndex App";
    const starterQuestions = uiConfig?.starterQuestions ?? [];
    const llamaCloudApi =
      uiConfig?.llamaCloudIndexSelector && getEnv("LLAMA_CLOUD_API_KEY")
        ? "/api/chat/config/llamacloud"
        : undefined;
    const componentsApi = this.componentsDir ? "/api/components" : undefined;
    const devMode = uiConfig?.devMode ?? false;

    // content in javascript format
    const content = `
      window.LLAMAINDEX = {
        CHAT_API: '/api/chat',
        APP_TITLE: ${JSON.stringify(appTitle)},
        LLAMA_CLOUD_API: ${JSON.stringify(llamaCloudApi)},
        STARTER_QUESTIONS: ${JSON.stringify(starterQuestions)},
        COMPONENTS_API: ${JSON.stringify(componentsApi)},
        DEV_MODE: ${JSON.stringify(devMode)}
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
      const handle = this.app.getRequestHandler();
      handle(req, res, parsedUrl);
    });

    server.listen(this.port, () => {
      console.log(`> Server listening at http://localhost:${this.port}`);
    });
  }
}

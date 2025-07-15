import { getEnv } from "@llamaindex/env";
import type { Workflow } from "@llamaindex/workflow";
import fs from "fs";
import { createServer } from "http";
import next from "next";
import path from "path";
import { parse } from "url";
import { promisify } from "util";
import { handleChat } from "./handlers/chat";
import type {
  LlamaCloudConfig,
  LlamaDeployConfig,
  LlamaIndexServerOptions,
} from "./types";

const nextDir = path.join(__dirname, "..", "server");
const configFile = path.join(__dirname, "..", "server", "public", "config.js");
const nextConfigFile = path.join(nextDir, "next.config.ts");
const constantsFile = path.join(nextDir, "app", "constants.ts");
const dev = process.env.NODE_ENV !== "production";

export class LlamaIndexServer {
  port: number;
  app: ReturnType<typeof next>;
  workflowFactory?: (() => Promise<Workflow> | Workflow) | undefined;
  componentsDir?: string | undefined;
  layoutDir: string;
  suggestNextQuestions: boolean;
  llamaDeploy?: LlamaDeployConfig | undefined;
  serverUrl: string;
  fileServer: string;
  llamaCloud?: LlamaCloudConfig | undefined;

  constructor(options: LlamaIndexServerOptions) {
    const { workflow, suggestNextQuestions, ...nextAppOptions } = options;
    this.app = next({ dev, dir: nextDir, ...nextAppOptions });
    this.port = nextAppOptions.port ?? parseInt(process.env.PORT || "3000", 10);
    this.workflowFactory = workflow;
    this.componentsDir = options.uiConfig?.componentsDir;
    this.layoutDir = options.uiConfig?.layoutDir ?? "layout";
    this.suggestNextQuestions = suggestNextQuestions ?? true;

    this.llamaDeploy = options.uiConfig?.llamaDeploy;
    this.serverUrl = options.uiConfig?.serverUrl || ""; // use current host if not set

    this.llamaCloud = options.llamaCloud;
    if (this.llamaCloud?.indexSelector && !getEnv("LLAMA_CLOUD_API_KEY")) {
      throw new Error(
        "LlamaCloud API key is required. Please set `LLAMA_CLOUD_API_KEY` in environment variables",
      );
    }

    const defaultFileServer = this.llamaCloud
      ? this.llamaCloud.outputDir
      : "data";
    this.fileServer = options.fileServer ?? defaultFileServer;

    if (this.llamaDeploy) {
      if (!this.llamaDeploy.deployment || !this.llamaDeploy.workflow) {
        throw new Error(
          "LlamaDeploy requires deployment and workflow to be set",
        );
      }
      const { devMode, enableFileUpload } = options.uiConfig ?? {};
      const llamaCloudIndexSelector = this.llamaCloud?.indexSelector;

      if (devMode || llamaCloudIndexSelector || enableFileUpload) {
        throw new Error(
          "`devMode`, `llamaCloudIndexSelector`, and `enableFileUpload` are not supported when enabling LlamaDeploy",
        );
      }
    } else {
      // if llamaDeploy is not set but workflowFactory is not defined, we should throw an error
      if (!this.workflowFactory) {
        throw new Error("workflowFactory is required for chat api to work");
      }
    }

    if (this.componentsDir) {
      this.createComponentsDir(this.componentsDir);
    }

    this.modifyConfig(options);
    this.modifySourcesForLlamaDeploy();
  }

  private modifySourcesForLlamaDeploy() {
    if (!this.llamaDeploy) return;
    const deployment = this.llamaDeploy.deployment;
    const basePath = `/deployments/${deployment}/ui`;

    // create next.config.ts with basePath
    const nextConfigContent = `
export default {
  basePath: '${basePath}',
}
`;
    fs.writeFileSync(nextConfigFile, nextConfigContent);

    // some UI code use absolute paths, such as /llama.png, /config.js, etc.
    // so that we need to update basePath for them
    const constantsContent = fs.readFileSync(constantsFile, "utf8");
    const newConstantsContent = constantsContent.replace(
      'export const BASE_PATH = ""',
      `export const BASE_PATH = "${basePath}"`,
    );
    fs.writeFileSync(constantsFile, newConstantsContent, "utf8");
  }

  private modifyConfig(options: LlamaIndexServerOptions) {
    const { uiConfig } = options;

    const basePath = this.llamaDeploy
      ? `/deployments/${this.llamaDeploy.deployment}/ui`
      : "";

    const starterQuestions = uiConfig?.starterQuestions ?? [];
    const llamaCloudApi =
      this.llamaCloud?.indexSelector && getEnv("LLAMA_CLOUD_API_KEY")
        ? `${basePath}/api/chat/config/llamacloud`
        : undefined;
    const componentsApi = this.componentsDir
      ? `${basePath}/api/components`
      : undefined;
    const layoutApi = this.layoutDir ? `${basePath}/api/layout` : undefined;
    const devMode = uiConfig?.devMode ?? false;
    const enableFileUpload = uiConfig?.enableFileUpload ?? false;
    const uploadApi = enableFileUpload ? `${basePath}/api/files` : undefined;

    // construct file server url for LlamaDeploy
    // eg. for Non-LlamaCloud: localhost:3000/deployments/chat/ui/api/files/data
    // eg. for LlamaCloud: localhost:3000/deployments/chat/ui/api/files/output/llamacloud
    const fileServerUrl = `${this.serverUrl}${basePath}/api/files/${this.fileServer}`;

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
        UPLOAD_API: ${JSON.stringify(uploadApi)},
        DEPLOYMENT: ${JSON.stringify(this.llamaDeploy?.deployment)},
        WORKFLOW: ${JSON.stringify(this.llamaDeploy?.workflow)},
        FILE_SERVER_URL: ${JSON.stringify(fileServerUrl)}
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

      if (
        pathname === "/api/chat" &&
        req.method === "POST" &&
        this.workflowFactory
      ) {
        // because of https://github.com/vercel/next.js/discussions/79402 we can't use route.ts here, so we need to call this custom route
        // when calling `pnpm eject`, the user will get an equivalent route at [path to chat route.ts]
        // make sure to keep its semantic in sync with handleChat
        return handleChat(
          req,
          res,
          this.workflowFactory,
          this.suggestNextQuestions,
          this.llamaCloud?.outputDir,
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

      if (
        pathname?.includes("/api/files") &&
        req.method === "GET" &&
        this.llamaCloud
      ) {
        query.useLlamaCloud = "true";
      }

      const handle = this.app.getRequestHandler();
      handle(req, res, { ...parsedUrl, query });
    });

    server.listen(this.port, () => {
      console.log(`> Server listening at http://localhost:${this.port}`);
    });
  }
}

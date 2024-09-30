/*
 * Copyright 2023 FoundryLabs, Inc., LlamaIndex Inc.
 * Portions of this file are copied from the e2b project (https://github.com/e2b-dev/ai-artifacts)
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CodeInterpreter, Result, Sandbox } from "@e2b/code-interpreter";
import type { JSONSchemaType } from "ajv";
import {
  BaseTool,
  ChatMessage,
  JSONValue,
  Settings,
  ToolMetadata,
} from "llamaindex";
import crypto from "node:crypto";
import { TOOL_OUTPUT_DIR, saveToolOutput } from "./shared";

const CODE_GENERATION_PROMPT = `You are a skilled software engineer. You do not make mistakes. Generate an artifact. You can install additional dependencies. You can use one of the following templates:\n

1. code-interpreter-multilang: "Runs code as a Jupyter notebook cell. Strong data analysis angle. Can use complex visualisation to explain results.". File: script.py. Dependencies installed: python, jupyter, numpy, pandas, matplotlib, seaborn, plotly. Port: none.

2. nextjs-developer: "A Next.js 13+ app that reloads automatically. Using the pages router.". File: pages/index.tsx. Dependencies installed: nextjs@14.2.5, typescript, @types/node, @types/react, @types/react-dom, postcss, tailwindcss, shadcn. Port: 3000.

3. vue-developer: "A Vue.js 3+ app that reloads automatically. Only when asked specifically for a Vue app.". File: app.vue. Dependencies installed: vue@latest, nuxt@3.13.0, tailwindcss. Port: 3000.

4. streamlit-developer: "A streamlit app that reloads automatically.". File: app.py. Dependencies installed: streamlit, pandas, numpy, matplotlib, request, seaborn, plotly. Port: 8501.

5. gradio-developer: "A gradio app. Gradio Blocks/Interface should be called demo.". File: app.py. Dependencies installed: gradio, pandas, numpy, matplotlib, request, seaborn, plotly. Port: 7860.

Provide detail information about the artifact you're about to generate in the following JSON format with the following keys:
  
commentary: Describe what you're about to do and the steps you want to take for generating the artifact in great detail.
template: Name of the template used to generate the artifact.
title: Short title of the artifact. Max 3 words.
description: Short description of the artifact. Max 1 sentence.
additional_dependencies: Additional dependencies required by the artifact. Do not include dependencies that are already included in the template.
has_additional_dependencies: Detect if additional dependencies that are not included in the template are required by the artifact.
install_dependencies_command: Command to install additional dependencies required by the artifact.
port: Port number used by the resulted artifact. Null when no ports are exposed.
file_path: Relative path to the file, including the file name.
code: Code generated by the artifact. Only runnable code is allowed.

Make sure to use the correct syntax for the programming language you're using.
`;

// detail information to execute code
export type Artifact = {
  commentary: string;
  template: string;
  title: string;
  description: string;
  additional_dependencies: string[];
  has_additional_dependencies: boolean;
  install_dependencies_command: string;
  port: number | null;
  file_path: string;
  code: string;
};

export type ArtifactResult = {
  template: string;
  sandboxUrl?: string; // the url to the sandbox (output when running web app)
  outputUrls?: Array<{
    url: string;
    filename: string;
  }>; // the urls to the output files (output when running in python environment)
  stdout?: string[];
  stderr?: string[];
};

export type ArtifactParameter = {
  requirement: string;
};

export type ArtifactToolParams = {
  metadata?: ToolMetadata<JSONSchemaType<ArtifactParameter>>;
  apiKey?: string;
  timeout?: number;
  fileServerURLPrefix?: string;
};

const DEFAULT_META_DATA: ToolMetadata<JSONSchemaType<ArtifactParameter>> = {
  name: "artifact",
  description: `Generate an artifact based on the input then execute it and return sandbox url.`,
  parameters: {
    type: "object",
    properties: {
      requirement: {
        type: "string",
        description: "The description of the application you want to build.",
      },
    },
    required: ["requirement"],
  },
};

export class ArtifactTool implements BaseTool<ArtifactParameter> {
  metadata: ToolMetadata<JSONSchemaType<ArtifactParameter>>;
  apiKey: string;
  fileServerURLPrefix: string;
  timeout: number;

  constructor(params?: ArtifactToolParams) {
    this.metadata = params?.metadata || DEFAULT_META_DATA;
    this.timeout = params?.timeout || 10 * 60 * 1000; // 10 minutes in ms
    this.apiKey = params?.apiKey || process.env.E2B_API_KEY || "";
    this.fileServerURLPrefix =
      params?.fileServerURLPrefix || process.env.FILESERVER_URL_PREFIX || "";

    if (!this.apiKey) {
      throw new Error("E2B_API_KEY is not set");
    }

    if (!this.fileServerURLPrefix) {
      throw new Error(
        "FILESERVER_URL_PREFIX is required to display file output from sandbox",
      );
    }
  }

  async call(input: ArtifactParameter) {
    try {
      const artifact = await this.generateArtifact(input.requirement);
      const result = await this.executeArtifact(artifact);
      console.log({ artifact, result });
      return { artifact, result, isError: false } as unknown as JSONValue;
    } catch (error) {
      return { isError: true };
    }
  }

  // Generate artifact (code, environment, dependencies, etc.)
  async generateArtifact(query: string): Promise<Artifact> {
    const messages: ChatMessage[] = [
      { role: "system", content: CODE_GENERATION_PROMPT },
      { role: "user", content: query },
    ];
    try {
      const response = await Settings.llm.chat({ messages });
      const content = response.message.content.toString();
      const jsonContent = content
        .replace(/^```json\s*|\s*```$/g, "")
        .replace(/^`+|`+$/g, "")
        .trim();
      const artifact = JSON.parse(jsonContent) as Artifact;
      return artifact;
    } catch (error) {
      console.log("Failed to generate artifact", error);
      throw error;
    }
  }

  // Execute artifact
  async executeArtifact(artifact: Artifact): Promise<ArtifactResult> {
    try {
      if (artifact.template === "code-interpreter-multilang") {
        return this.runInCodeInterpreter(artifact);
      }
      return this.runInSandbox(artifact);
    } catch (error) {
      console.log("Failed to execute artifact", error);
      throw error;
    }
  }

  // Execute artifact in sandbox (use for web apps)
  private async runInSandbox(artifact: Artifact): Promise<ArtifactResult> {
    // Create sandbox
    const sandbox = await Sandbox.create(artifact.template, {
      metadata: { template: artifact.template, userID: "default" },
      timeoutMs: this.timeout,
      apiKey: this.apiKey,
    });

    // Install dependencies and copy code to sandbox
    if (artifact.has_additional_dependencies) {
      await sandbox.commands.run(artifact.install_dependencies_command);
    }
    await sandbox.files.write(artifact.file_path, artifact.code);

    // Return the sandbox URL
    return {
      template: artifact.template,
      sandboxUrl: `https://${sandbox?.getHost(artifact.port || 80)}`,
    };
  }

  // Execute artifact in code interpreter (use for python apps)
  private async runInCodeInterpreter(
    artifact: Artifact,
  ): Promise<ArtifactResult> {
    // create code interpreter
    const codeInterpreter = await CodeInterpreter.create({
      metadata: { template: artifact.template, userID: "default" },
      timeoutMs: this.timeout,
      apiKey: this.apiKey,
    });

    // Install dependencies and copy code to code interpreter
    if (artifact.has_additional_dependencies) {
      await codeInterpreter.notebook.execCell(
        artifact.install_dependencies_command,
      );
    }
    await codeInterpreter.files.write(artifact.file_path, artifact.code);

    // Execute code in notebook and return output urls
    const result = await codeInterpreter.notebook.execCell(artifact.code || "");
    const { results: cellResults, logs, error } = result;
    const outputUrls = await this.downloadCellResults(cellResults);
    await codeInterpreter.close();
    return {
      template: artifact.template,
      outputUrls,
      stdout: logs.stdout,
      stderr: logs.stderr,
    };
  }

  private async downloadCellResults(cellResults?: Result[]): Promise<
    Array<{
      url: string;
      filename: string;
    }>
  > {
    if (!cellResults) return [];
    return cellResults.flatMap((res) => {
      const formats = res.formats(); // available formats in the result
      return formats.map((ext) => {
        const filename = `${crypto.randomUUID()}.${ext}`;
        const fileUrl = `${this.fileServerURLPrefix}/${TOOL_OUTPUT_DIR}/${filename}`;
        const base64 = res[ext as keyof Result];
        saveToolOutput(base64, filename); // don't await to avoid blocking the request
        return { url: fileUrl, filename };
      });
    });
  }
}

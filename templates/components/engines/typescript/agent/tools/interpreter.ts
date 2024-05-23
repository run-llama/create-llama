import { CodeInterpreter, Logs, Result } from "@e2b/code-interpreter";
import type { JSONSchemaType } from "ajv";
import fs from "fs";
import { BaseTool, ToolMetadata } from "llamaindex";
import crypto from "node:crypto";
import path from "node:path";

export type InterpreterParameter = {
  code: string;
};

export type InterpreterToolParams = {
  metadata?: ToolMetadata<JSONSchemaType<InterpreterParameter>>;
  apiKey?: string;
  fileServerURLPrefix?: string;
};

export type InterpreterToolOuput = {
  isError: boolean;
  logs: Logs;
  extraResult: InterpreterExtraResult[];
};

type InterpreterExtraType =
  | "html"
  | "markdown"
  | "svg"
  | "png"
  | "jpeg"
  | "pdf"
  | "latex"
  | "json"
  | "javascript";

export type InterpreterExtraResult = {
  type: InterpreterExtraType;
  filename: string;
  url: string;
};

const DEFAULT_META_DATA: ToolMetadata<JSONSchemaType<InterpreterParameter>> = {
  name: "interpreter",
  description:
    "Execute python code in a Jupyter notebook cell and return any result, stdout, stderr, display_data, and error.",
  parameters: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "The python code to execute in a single cell.",
      },
    },
    required: ["code"],
  },
};

export class InterpreterTool implements BaseTool<InterpreterParameter> {
  private readonly outputDir = "tool-output";
  private apiKey?: string;
  private fileServerURLPrefix?: string;
  metadata: ToolMetadata<JSONSchemaType<InterpreterParameter>>;
  codeInterpreter?: CodeInterpreter;

  constructor(params?: InterpreterToolParams) {
    this.metadata = params?.metadata || DEFAULT_META_DATA;
    this.apiKey = params?.apiKey || process.env.E2B_API_KEY;
    this.fileServerURLPrefix =
      params?.fileServerURLPrefix || process.env.FILESERVER_URL_PREFIX;

    if (!this.apiKey) {
      throw new Error(
        "E2B_API_KEY key is required to run code interpreter. Get it here: https://e2b.dev/docs/getting-started/api-key",
      );
    }
    if (!this.fileServerURLPrefix) {
      throw new Error(
        "FILESERVER_URL_PREFIX is required to display file output from sandbox",
      );
    }
  }

  public async initInterpreter() {
    if (!this.codeInterpreter) {
      this.codeInterpreter = await CodeInterpreter.create({
        apiKey: this.apiKey,
      });
    }
    return this.codeInterpreter;
  }

  public async codeInterpret(code: string): Promise<InterpreterToolOuput> {
    console.log(
      `\n${"=".repeat(50)}\n> Running following AI-generated code:\n${code}\n${"=".repeat(50)}`,
    );
    const interpreter = await this.initInterpreter();
    const exec = await interpreter.notebook.execCell(code);
    if (exec.error) console.error("[Code Interpreter error]", exec.error);
    const extraResult = await this.getExtraResult(exec.results[0]);
    const result: InterpreterToolOuput = {
      isError: !!exec.error,
      logs: exec.logs,
      extraResult,
    };
    return result;
  }

  async call(input: InterpreterParameter): Promise<InterpreterToolOuput> {
    const result = await this.codeInterpret(input.code);
    await this.codeInterpreter?.close();
    return result;
  }

  private async getExtraResult(
    res?: Result,
  ): Promise<InterpreterExtraResult[]> {
    if (!res) return [];
    const output: InterpreterExtraResult[] = [];

    try {
      const formats = res.formats(); // formats available for the result. Eg: ['png', ...]
      const base64DataArr = formats.map((f) => res[f as keyof Result]); // get base64 data for each format

      // save base64 data to file and return the url
      for (let i = 0; i < formats.length; i++) {
        const ext = formats[i];
        const base64Data = base64DataArr[i];
        if (ext && base64Data) {
          const { filename } = this.saveToDisk(base64Data, ext);
          output.push({
            type: ext as InterpreterExtraType,
            filename,
            url: this.getFileUrl(filename),
          });
        }
      }
    } catch (error) {
      console.error("Error when saving data to disk", error);
    }

    return output;
  }

  // Consider saving to cloud storage instead but it may cost more for you
  // See: https://e2b.dev/docs/sandbox/api/filesystem#write-to-file
  private saveToDisk(
    base64Data: string,
    ext: string,
  ): {
    outputPath: string;
    filename: string;
  } {
    const filename = `${crypto.randomUUID()}.${ext}`; // generate a unique filename
    const buffer = Buffer.from(base64Data, "base64");
    const outputPath = this.getOutputPath(filename);
    fs.writeFileSync(outputPath, buffer);
    console.log(`Saved file to ${outputPath}`);
    return {
      outputPath,
      filename,
    };
  }

  private getOutputPath(filename: string): string {
    // if outputDir doesn't exist, create it
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    return path.join(this.outputDir, filename);
  }

  private getFileUrl(filename: string): string {
    return `${this.fileServerURLPrefix}/${this.outputDir}/${filename}`;
  }
}

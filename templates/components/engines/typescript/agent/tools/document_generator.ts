import { JSONSchemaType } from "ajv";
import fs from "fs";
import { BaseTool, ToolMetadata } from "llamaindex";
import { marked } from "marked";
import path from "path";

const OUTPUT_DIR = "output/tools";

type DocumentParameter = {
  originalContent: string;
  fileName: string;
};

const DEFAULT_METADATA: ToolMetadata<JSONSchemaType<DocumentParameter>> = {
  name: "document_generator",
  description:
    "Generate HTML document from markdown content. Return a file url to the document",
  parameters: {
    type: "object",
    properties: {
      originalContent: {
        type: "string",
        description: "The original markdown content to convert.",
      },
      fileName: {
        type: "string",
        description: "The name of the document file (without extension).",
      },
    },
    required: ["originalContent", "fileName"],
  },
};

const COMMON_STYLES = `
  body {
    font-family: Arial, sans-serif;
    line-height: 1.3;
    color: #333;
  }
  h1, h2, h3, h4, h5, h6 {
    margin-top: 1em;
    margin-bottom: 0.5em;
  }
  p {
    margin-bottom: 0.7em;
  }
  code {
    background-color: #f4f4f4;
    padding: 2px 4px;
    border-radius: 4px;
  }
  pre {
    background-color: #f4f4f4;
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 1em;
  }
  th, td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
  }
  th {
    background-color: #f2f2f2;
    font-weight: bold;
  }
  img {
    max-width: 90%;
    height: auto;
    display: block;
    margin: 1em auto;
    border-radius: 10px;
  }
`;

const HTML_SPECIFIC_STYLES = `
  body {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }
`;

const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        ${COMMON_STYLES}
        ${HTML_SPECIFIC_STYLES}
    </style>
</head>
<body>
    {{content}}
</body>
</html>
`;

export interface DocumentGeneratorParams {
  metadata?: ToolMetadata<JSONSchemaType<DocumentParameter>>;
}

export class DocumentGenerator implements BaseTool<DocumentParameter> {
  metadata: ToolMetadata<JSONSchemaType<DocumentParameter>>;

  constructor(params: DocumentGeneratorParams) {
    this.metadata = params.metadata ?? DEFAULT_METADATA;
  }

  private static async generateHtmlContent(
    originalContent: string,
  ): Promise<string> {
    return await marked(originalContent);
  }

  private static generateHtmlDocument(htmlContent: string): string {
    return HTML_TEMPLATE.replace("{{content}}", htmlContent);
  }

  private static validateFileName(fileName: string): string {
    if (path.isAbsolute(fileName)) {
      throw new Error("File name is not allowed.");
    }
    if (/^[a-zA-Z0-9_.-]+$/.test(fileName)) {
      return fileName;
    } else {
      throw new Error(
        "File name is not allowed to contain special characters.",
      );
    }
  }

  private static writeToFile(content: string | Buffer, filePath: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (typeof content === "string") {
      fs.writeFileSync(filePath, content, "utf8");
    } else {
      fs.writeFileSync(filePath, content);
    }
  }

  async call(input: DocumentParameter): Promise<string> {
    const { originalContent, fileName } = input;

    const htmlContent =
      await DocumentGenerator.generateHtmlContent(originalContent);
    const fileContent = DocumentGenerator.generateHtmlDocument(htmlContent);

    const validatedFileName = DocumentGenerator.validateFileName(fileName);
    const filePath = path.join(OUTPUT_DIR, `${validatedFileName}.html`);

    DocumentGenerator.writeToFile(fileContent, filePath);

    const fileUrl = `${process.env.FILESERVER_URL_PREFIX}/${filePath}`;
    return fileUrl;
  }
}

export function getTools(): BaseTool[] {
  return [new DocumentGenerator({})];
}

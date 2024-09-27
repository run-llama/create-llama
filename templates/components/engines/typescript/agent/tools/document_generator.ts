import { JSONSchemaType } from "ajv";
import fs from "fs";
import { BaseTool, ToolMetadata } from "llamaindex";
import { marked } from "marked";
import path from "path";
import puppeteer from "puppeteer";

const OUTPUT_DIR = "output/tools";

enum DocumentType {
  HTML = "html",
  PDF = "pdf",
}

type DocumentParameter = {
  originalContent: string;
  documentType: string;
  fileName: string;
};

const DEFAULT_METADATA: ToolMetadata<JSONSchemaType<DocumentParameter>> = {
  name: "document_generator",
  description:
    "Generate document as PDF or HTML file from markdown content. Return a file url to the document",
  parameters: {
    type: "object",
    properties: {
      originalContent: {
        type: "string",
        description: "The original markdown content to convert.",
      },
      documentType: {
        type: "string",
        description: "The type of document to generate (pdf or html).",
      },
      fileName: {
        type: "string",
        description: "The name of the document file (without extension).",
      },
    },
    required: ["originalContent", "documentType", "fileName"],
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

const PDF_SPECIFIC_STYLES = `
  @page {
    size: letter;
    margin: 2cm;
  }
  body {
    font-size: 11pt;
  }
  h1 { font-size: 18pt; }
  h2 { font-size: 16pt; }
  h3 { font-size: 14pt; }
  h4, h5, h6 { font-size: 12pt; }
  pre, code {
    font-family: Courier, monospace;
    font-size: 0.9em;
  }
`;

export interface DocumentGeneratorParams {
  metadata?: ToolMetadata<JSONSchemaType<DocumentParameter>>;
}

export class DocumentGenerator implements BaseTool<DocumentParameter> {
  metadata: ToolMetadata<JSONSchemaType<DocumentParameter>>;

  constructor(params: DocumentGeneratorParams) {
    this.metadata = params.metadata ?? DEFAULT_METADATA;
  }

  private static generateHtmlContent(originalContent: string): string {
    return marked(originalContent);
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
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      if (typeof content === "string") {
        fs.writeFileSync(filePath, content, "utf8");
      } else {
        fs.writeFileSync(filePath, content);
      }
    } catch (error) {
      throw error;
    }
  }

  private static generatePdfDocument(htmlContent: string): string {
    return HTML_TEMPLATE.replace("{{content}}", htmlContent).replace(
      HTML_SPECIFIC_STYLES,
      PDF_SPECIFIC_STYLES,
    );
  }

  private static async generatePdf(htmlContent: string): Promise<Buffer> {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4" });
    await browser.close();
    return pdf;
  }

  async call(input: DocumentParameter): Promise<string> {
    const { originalContent, documentType, fileName } = input;

    let fileContent: string | Buffer;
    let fileExtension: string;

    // Generate the HTML from the original content (markdown)
    const htmlContent = DocumentGenerator.generateHtmlContent(originalContent);

    try {
      if (documentType.toLowerCase() === DocumentType.HTML) {
        fileContent = DocumentGenerator.generateHtmlDocument(htmlContent);
        fileExtension = "html";
      } else if (documentType.toLowerCase() === DocumentType.PDF) {
        const pdfDocument = DocumentGenerator.generatePdfDocument(htmlContent);
        fileContent = await DocumentGenerator.generatePdf(pdfDocument);
        fileExtension = "pdf";
      } else {
        throw new Error(
          `Invalid document type: ${documentType}. Must be 'pdf' or 'html'.`,
        );
      }
    } catch (error) {
      console.error("Error generating document:", error);
      throw new Error("Failed to generate document");
    }

    const validatedFileName = DocumentGenerator.validateFileName(fileName);
    const filePath = path.join(
      OUTPUT_DIR,
      `${validatedFileName}.${fileExtension}`,
    );

    DocumentGenerator.writeToFile(fileContent, filePath);

    const fileUrl = `${process.env.FILESERVER_URL_PREFIX}/${filePath}`;
    return fileUrl;
  }
}

export function getTools(): BaseTool[] {
  return [new DocumentGenerator({})];
}

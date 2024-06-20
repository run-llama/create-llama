import type { JSONSchemaType } from "ajv";
import FormData from "form-data";
import fs from "fs";
import got from "got";
import { BaseTool, ToolMetadata } from "llamaindex";
import path from "node:path";

export type ImgGeneratorParameter = {
  prompt: string;
};

export type ImgGeneratorToolParams = {
  metadata?: ToolMetadata<JSONSchemaType<ImgGeneratorParameter>>;
};

export type ImgGeneratorToolOutput = {
  isSuccess: boolean;
  imageUrl?: string;
  errorMessage?: string;
};

const DEFAULT_META_DATA: ToolMetadata<JSONSchemaType<ImgGeneratorParameter>> = {
  name: "image_generator",
  description: `Use this function to generate an image based on the prompt.`,
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "The prompt to generate the image",
      },
    },
    required: ["prompt"],
  },
};

export class ImgGeneratorTool implements BaseTool<ImgGeneratorParameter> {
  readonly IMG_OUTPUT_FORMAT = "webp";
  readonly IMG_OUTPUT_DIR = "tool-output";
  readonly IMG_GEN_API =
    "https://api.stability.ai/v2beta/stable-image/generate/core";

  metadata: ToolMetadata<JSONSchemaType<ImgGeneratorParameter>>;

  constructor(params?: ImgGeneratorToolParams) {
    this.checkRequiredEnvVars();
    this.metadata = params?.metadata || DEFAULT_META_DATA;
  }

  async call(input: ImgGeneratorParameter): Promise<ImgGeneratorToolOutput> {
    return await this.generateImage(input.prompt);
  }

  private generateImage = async (
    prompt: string,
  ): Promise<ImgGeneratorToolOutput> => {
    try {
      const buffer = await this.promptToImgBuffer(prompt);
      const imageUrl = this.saveImage(buffer);
      return { isSuccess: true, imageUrl };
    } catch (error) {
      console.error(error);
      return {
        isSuccess: false,
        errorMessage: "Failed to generate image. Please try again.",
      };
    }
  };

  private promptToImgBuffer = async (prompt: string) => {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("output_format", this.IMG_OUTPUT_FORMAT);
    const buffer = await got
      .post(this.IMG_GEN_API, {
        body: form,
        headers: {
          Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
          Accept: "image/*",
        },
      })
      .buffer();
    return buffer;
  };

  private saveImage = (buffer: Buffer) => {
    const filename = `${crypto.randomUUID()}.${this.IMG_OUTPUT_FORMAT}`;
    const outputPath = path.join(this.IMG_OUTPUT_DIR, filename);
    fs.writeFileSync(outputPath, buffer);
    const url = `${process.env.FILESERVER_URL_PREFIX}/${this.IMG_OUTPUT_DIR}/${filename}`;
    console.log(`Saved image to ${outputPath}.\nURL: ${url}`);
    return url;
  };

  private checkRequiredEnvVars = () => {
    if (!process.env.STABILITY_API_KEY) {
      throw new Error(
        "STABILITY_API_KEY key is required to run image generator. Get it here: https://platform.stability.ai/account/keys",
      );
    }
    if (!process.env.FILESERVER_URL_PREFIX) {
      throw new Error(
        "FILESERVER_URL_PREFIX is required to display file output after generation",
      );
    }
  };
}

import path from "path";
import { templatesDir } from "./dir";
import { TemplateDataSource } from "./types";

export const EXAMPLE_FILE: TemplateDataSource = {
  type: "file",
  config: {
    path: path.join(templatesDir, "components", "data", "101.pdf"),
  },
};

export function getDataSources(
  files?: string,
  exampleFile?: boolean,
): TemplateDataSource[] | undefined {
  let dataSources: TemplateDataSource[] | undefined = undefined;
  if (files) {
    // If user specified files option, then the program should use context engine
    dataSources = files.split(",").map((filePath) => ({
      type: "file",
      config: {
        path: filePath,
      },
    }));
  }
  if (exampleFile) {
    dataSources = [...(dataSources ? dataSources : []), EXAMPLE_FILE];
  }
  return dataSources;
}

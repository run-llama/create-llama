import fs from "fs/promises";
import path from "path";
import yaml, { Document } from "yaml";
import { templatesDir } from "./dir";
import {
  DbSourceConfig,
  TemplateDataSource,
  TemplateType,
  WebSourceConfig,
} from "./types";

export function getExampleData(template?: TemplateType): TemplateDataSource {
  if (template && template === "extractor") {
    return {
      type: "file",
      config: {
        path: path.join(templatesDir, "components", "data", "apple_2020.pdf"),
      },
    } as TemplateDataSource;
  } else {
    return {
      type: "file",
      config: {
        path: path.join(templatesDir, "components", "data", "101.pdf"),
      },
    } as TemplateDataSource;
  }
}

export function getDataSources(
  files?: string,
  exampleFile?: boolean,
  template?: TemplateType,
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
  if (exampleFile && template) {
    dataSources = [
      ...(dataSources ? dataSources : []),
      getExampleData(template),
    ];
  }
  return dataSources;
}

export async function writeLoadersConfig(
  root: string,
  dataSources: TemplateDataSource[],
  useLlamaParse?: boolean,
) {
  const loaderConfig: Record<string, any> = {};

  // Always set file loader config
  loaderConfig.file = createFileLoaderConfig(useLlamaParse);

  if (dataSources.some((ds) => ds.type === "web")) {
    loaderConfig.web = createWebLoaderConfig(dataSources);
  }

  const dbLoaders = dataSources.filter((ds) => ds.type === "db");
  if (dbLoaders.length > 0) {
    loaderConfig.db = createDbLoaderConfig(dbLoaders);
  }

  // Create a new Document with the loaderConfig
  const yamlDoc = new Document(loaderConfig);

  // Write loaders config
  const loaderConfigPath = path.join(root, "config", "loaders.yaml");
  await fs.mkdir(path.join(root, "config"), { recursive: true });
  await fs.writeFile(loaderConfigPath, yaml.stringify(yamlDoc));
}

function createWebLoaderConfig(dataSources: TemplateDataSource[]): any {
  const webLoaderConfig: Record<string, any> = {};

  // Create config for browser driver arguments
  webLoaderConfig.driver_arguments = [
    "--no-sandbox",
    "--disable-dev-shm-usage",
  ];

  // Create config for urls
  const urlConfigs = dataSources
    .filter((ds) => ds.type === "web")
    .map((ds) => {
      const dsConfig = ds.config as WebSourceConfig;
      return {
        base_url: dsConfig.baseUrl,
        prefix: dsConfig.prefix,
        depth: dsConfig.depth,
      };
    });
  webLoaderConfig.urls = urlConfigs;

  return webLoaderConfig;
}

function createFileLoaderConfig(useLlamaParse?: boolean): any {
  return {
    use_llama_parse: useLlamaParse,
  };
}

function createDbLoaderConfig(dbLoaders: TemplateDataSource[]): any {
  return dbLoaders.map((ds) => {
    const dsConfig = ds.config as DbSourceConfig;
    return {
      uri: dsConfig.uri,
      queries: [dsConfig.queries],
    };
  });
}

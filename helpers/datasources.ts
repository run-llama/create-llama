import fs from "fs/promises";
import path from "path";
import yaml, { Document } from "yaml";
import { templatesDir } from "./dir";
import { DbSourceConfig, TemplateDataSource, WebSourceConfig } from "./types";

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

export async function writeLoadersConfig(
  root: string,
  dataSources: TemplateDataSource[],
  useLlamaParse?: boolean,
) {
  if (dataSources.length === 0) return; // no datasources, no config needed
  const loaderConfig = new Document({});
  // Web loader config
  if (dataSources.some((ds) => ds.type === "web")) {
    const webLoaderConfig = new Document({});

    // Create config for browser driver arguments
    const driverArgNodeValue = webLoaderConfig.createNode([
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ]);
    driverArgNodeValue.commentBefore =
      " The arguments to pass to the webdriver. E.g.: add --headless to run in headless mode";
    webLoaderConfig.set("driver_arguments", driverArgNodeValue);

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
    const urlConfigNode = webLoaderConfig.createNode(urlConfigs);
    urlConfigNode.commentBefore = ` base_url: The URL to start crawling with
 prefix: Only crawl URLs matching the specified prefix
 depth: The maximum depth for BFS traversal
 You can add more websites by adding more entries (don't forget the - prefix from YAML)`;
    webLoaderConfig.set("urls", urlConfigNode);

    // Add web config to the loaders config
    loaderConfig.set("web", webLoaderConfig);
  }

  // File loader config
  if (dataSources.some((ds) => ds.type === "file")) {
    // Add documentation to web loader config
    const node = loaderConfig.createNode({
      use_llama_parse: useLlamaParse,
    });
    node.commentBefore = ` use_llama_parse: Use LlamaParse if \`true\`. Needs a \`LLAMA_CLOUD_API_KEY\` from https://cloud.llamaindex.ai set as environment variable`;
    loaderConfig.set("file", node);
  }

  // DB loader config
  const dbLoaders = dataSources.filter((ds) => ds.type === "db");
  if (dbLoaders.length > 0) {
    const dbLoaderConfig = new Document({});
    const configEntries = dbLoaders.map((ds) => {
      const dsConfig = ds.config as DbSourceConfig;
      return {
        uri: dsConfig.uri,
        queries: [dsConfig.queries],
      };
    });

    const node = dbLoaderConfig.createNode(configEntries);
    node.commentBefore = ` The configuration for the database loader, only supports MySQL and PostgreSQL databases for now.
 uri: The URI for the database. E.g.: mysql+pymysql://user:password@localhost:3306/db or postgresql+psycopg2://user:password@localhost:5432/db
 query: The query to fetch data from the database. E.g.: SELECT * FROM table`;
    loaderConfig.set("db", node);
  }

  // Write loaders config
  const loaderConfigPath = path.join(root, "config", "loaders.yaml");
  await fs.mkdir(path.join(root, "config"), { recursive: true });
  await fs.writeFile(loaderConfigPath, yaml.stringify(loaderConfig));
}

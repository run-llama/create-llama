import fs from "fs/promises";
import path from "path";
import { cyan, red } from "picocolors";
import { parse, stringify } from "smol-toml";
import terminalLink from "terminal-link";
import yaml, { Document } from "yaml";
import { copy } from "./copy";
import { templatesDir } from "./dir";
import { isPoetryAvailable, tryPoetryInstall } from "./poetry";
import { Tool } from "./tools";
import {
  InstallTemplateArgs,
  TemplateDataSource,
  TemplateVectorDB,
  WebSourceConfig,
} from "./types";

interface Dependency {
  name: string;
  version?: string;
  extras?: string[];
}

const getAdditionalDependencies = (
  vectorDb?: TemplateVectorDB,
  dataSource?: TemplateDataSource,
  tools?: Tool[],
) => {
  const dependencies: Dependency[] = [];

  // Add vector db dependencies
  switch (vectorDb) {
    case "mongo": {
      dependencies.push({
        name: "llama-index-vector-stores-mongodb",
        version: "^0.1.3",
      });
      break;
    }
    case "pg": {
      dependencies.push({
        name: "llama-index-vector-stores-postgres",
        version: "^0.1.1",
      });
    }
    case "pinecone": {
      dependencies.push({
        name: "llama-index-vector-stores-pinecone",
        version: "^0.1.3",
      });
      break;
    }
    case "milvus": {
      dependencies.push({
        name: "llama-index-vector-stores-milvus",
        version: "^0.1.6",
      });
      dependencies.push({
        name: "pymilvus",
        version: "2.3.7",
      });
      break;
    }
  }

  // Add data source dependencies
  const dataSourceType = dataSource?.type;
  if (dataSourceType === "file") {
    // llama-index-readers-file (pdf, excel, csv) is already included in llama_index package
    dependencies.push({
      name: "docx2txt",
      version: "^0.8",
    });
  } else if (dataSourceType === "web") {
    dependencies.push({
      name: "llama-index-readers-web",
      version: "^0.1.6",
    });
  }

  // Add tools dependencies
  tools?.forEach((tool) => {
    tool.dependencies?.forEach((dep) => {
      dependencies.push(dep);
    });
  });

  return dependencies;
};

const mergePoetryDependencies = (
  dependencies: Dependency[],
  existingDependencies: Record<string, Omit<Dependency, "name">>,
) => {
  for (const dependency of dependencies) {
    let value = existingDependencies[dependency.name] ?? {};

    // default string value is equal to attribute "version"
    if (typeof value === "string") {
      value = { version: value };
    }

    value.version = dependency.version ?? value.version;
    value.extras = dependency.extras ?? value.extras;

    if (value.version === undefined) {
      throw new Error(
        `Dependency "${dependency.name}" is missing attribute "version"!`,
      );
    }

    existingDependencies[dependency.name] = value;
  }
};

export const addDependencies = async (
  projectDir: string,
  dependencies: Dependency[],
) => {
  if (dependencies.length === 0) return;

  const FILENAME = "pyproject.toml";
  try {
    // Parse toml file
    const file = path.join(projectDir, FILENAME);
    const fileContent = await fs.readFile(file, "utf8");
    const fileParsed = parse(fileContent);

    // Modify toml dependencies
    const tool = fileParsed.tool as any;
    const existingDependencies = tool.poetry.dependencies;
    mergePoetryDependencies(dependencies, existingDependencies);

    // Write toml file
    const newFileContent = stringify(fileParsed);
    await fs.writeFile(file, newFileContent);

    const dependenciesString = dependencies.map((d) => d.name).join(", ");
    console.log(`\nAdded ${dependenciesString} to ${cyan(FILENAME)}\n`);
  } catch (error) {
    console.log(
      `Error while updating dependencies for Poetry project file ${FILENAME}\n`,
      error,
    );
  }
};

export const installPythonDependencies = (
  { noRoot }: { noRoot: boolean } = { noRoot: false },
) => {
  if (isPoetryAvailable()) {
    console.log(
      `Installing python dependencies using poetry. This may take a while...`,
    );
    const installSuccessful = tryPoetryInstall(noRoot);
    if (!installSuccessful) {
      console.error(
        red(
          "Installing dependencies using poetry failed. Please check error log above and try running create-llama again.",
        ),
      );
      process.exit(1);
    }
  } else {
    console.error(
      red(
        `Poetry is not available in the current environment. Please check ${terminalLink(
          "Poetry Installation",
          `https://python-poetry.org/docs/#installation`,
        )} to install poetry first, then run create-llama again.`,
      ),
    );
    process.exit(1);
  }
};

export const installPythonTemplate = async ({
  root,
  template,
  framework,
  vectorDb,
  dataSources,
  tools,
  postInstallAction,
  useLlamaParse,
}: Pick<
  InstallTemplateArgs,
  | "root"
  | "framework"
  | "template"
  | "vectorDb"
  | "dataSources"
  | "tools"
  | "useLlamaParse"
  | "postInstallAction"
>) => {
  console.log("\nInitializing Python project with template:", template, "\n");
  const templatePath = path.join(templatesDir, "types", template, framework);
  await copy("**", root, {
    parents: true,
    cwd: templatePath,
    rename(name) {
      switch (name) {
        case "gitignore": {
          return `.${name}`;
        }
        // README.md is ignored by webpack-asset-relocator-loader used by ncc:
        // https://github.com/vercel/webpack-asset-relocator-loader/blob/e9308683d47ff507253e37c9bcbb99474603192b/src/asset-relocator.js#L227
        case "README-template.md": {
          return "README.md";
        }
        default: {
          return name;
        }
      }
    },
  });

  const compPath = path.join(templatesDir, "components");

  if (dataSources.length > 0) {
    const enginePath = path.join(root, "app", "engine");

    const vectorDbDirName = vectorDb ?? "none";
    const VectorDBPath = path.join(
      compPath,
      "vectordbs",
      "python",
      vectorDbDirName,
    );
    await copy("**", enginePath, {
      parents: true,
      cwd: VectorDBPath,
    });

    // Copy engine code
    if (tools !== undefined && tools.length > 0) {
      await copy("**", enginePath, {
        parents: true,
        cwd: path.join(compPath, "engines", "python", "agent"),
      });
      // Write tool configs
      const configContent: Record<string, any> = {};
      tools.forEach((tool) => {
        configContent[tool.name] = tool.config ?? {};
      });
      const configFilePath = path.join(root, "config/tools.yaml");
      await fs.mkdir(path.join(root, "config"), { recursive: true });
      await fs.writeFile(configFilePath, yaml.stringify(configContent));
    } else {
      await copy("**", enginePath, {
        parents: true,
        cwd: path.join(compPath, "engines", "python", "chat"),
      });
    }

    const loaderConfig = new Document({});
    const loaderPath = path.join(enginePath, "loaders");

    // Copy loaders to enginePath
    await copy("**", loaderPath, {
      parents: true,
      cwd: path.join(compPath, "loaders", "python"),
    });

    // Generate loaders config
    // Web loader config
    if (dataSources.some((ds) => ds.type === "web")) {
      const webLoaderConfig = dataSources
        .filter((ds) => ds.type === "web")
        .map((ds) => {
          const dsConfig = ds.config as WebSourceConfig;
          return {
            base_url: dsConfig.baseUrl,
            prefix: dsConfig.prefix,
            depth: dsConfig.depth,
          };
        });
      // Add documentation to web loader config
      const node = loaderConfig.createNode(webLoaderConfig);
      node.commentBefore = ` base_url: The URL to start crawling with
 prefix: Only crawl URLs matching the specified prefix
 depth: The maximum depth for BFS traversal
 You can add more websites by adding more entries (don't forget the - prefix from YAML)`;
      loaderConfig.set("web", node);
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
    // Write loaders config
    if (Object.keys(loaderConfig).length > 0) {
      const loaderConfigPath = path.join(root, "config/loaders.yaml");
      await fs.mkdir(path.join(root, "config"), { recursive: true });
      await fs.writeFile(loaderConfigPath, yaml.stringify(loaderConfig));
    }
  }

  const addOnDependencies = dataSources
    .map((ds) => getAdditionalDependencies(vectorDb, ds, tools))
    .flat();
  await addDependencies(root, addOnDependencies);

  if (postInstallAction === "runApp" || postInstallAction === "dependencies") {
    installPythonDependencies();
  }

  // Copy deployment files for python
  await copy("**", root, {
    cwd: path.join(compPath, "deployments", "python"),
  });
};

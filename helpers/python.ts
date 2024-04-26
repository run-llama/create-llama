import fs from "fs/promises";
import path from "path";
import { cyan, red } from "picocolors";
import { parse, stringify } from "smol-toml";
import terminalLink from "terminal-link";

import { assetRelocator, copy } from "./copy";
import { templatesDir } from "./dir";
import { isPoetryAvailable, tryPoetryInstall } from "./poetry";
import { Tool } from "./tools";
import {
  InstallTemplateArgs,
  ModelConfig,
  TemplateDataSource,
  TemplateVectorDB,
} from "./types";

interface Dependency {
  name: string;
  version?: string;
  extras?: string[];
}

const getAdditionalDependencies = (
  modelConfig: ModelConfig,
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
    case "astra": {
      dependencies.push({
        name: "llama-index-vector-stores-astra-db",
        version: "^0.1.5",
      });
      break;
    }
  }

  // Add data source dependencies
  const dataSourceType = dataSource?.type;
  switch (dataSourceType) {
    case "file":
      dependencies.push({
        name: "docx2txt",
        version: "^0.8",
      });
      break;
    case "web":
      dependencies.push({
        name: "llama-index-readers-web",
        version: "^0.1.6",
      });
      break;
    case "db":
      dependencies.push({
        name: "llama-index-readers-database",
        version: "^0.1.3",
      });
      dependencies.push({
        name: "pymysql",
        version: "^1.1.0",
        extras: ["rsa"],
      });
      dependencies.push({
        name: "psycopg2",
        version: "^2.9.9",
      });
      break;
  }

  // Add tools dependencies
  tools?.forEach((tool) => {
    tool.dependencies?.forEach((dep) => {
      dependencies.push(dep);
    });
  });

  switch (modelConfig.provider) {
    case "ollama":
      dependencies.push({
        name: "llama-index-llms-ollama",
        version: "0.1.2",
      });
      dependencies.push({
        name: "llama-index-embeddings-ollama",
        version: "0.1.2",
      });
      break;
    case "openai":
      dependencies.push({
        name: "llama-index-agent-openai",
        version: "0.2.2",
      });
      break;
    case "anthropic":
      dependencies.push({
        name: "llama-index-llms-anthropic",
        version: "0.1.10",
      });
      dependencies.push({
        name: "llama-index-embeddings-huggingface",
        version: "0.2.0",
      });
      break;
    case "gemini":
      dependencies.push({
        name: "llama-index-llms-gemini",
        version: "0.1.7",
      });
      dependencies.push({
        name: "llama-index-embeddings-gemini",
        version: "0.1.6",
      });
      break;
  }

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
  observability,
  modelConfig,
}: Pick<
  InstallTemplateArgs,
  | "root"
  | "framework"
  | "template"
  | "vectorDb"
  | "dataSources"
  | "tools"
  | "postInstallAction"
  | "observability"
  | "modelConfig"
>) => {
  console.log("\nInitializing Python project with template:", template, "\n");
  const templatePath = path.join(templatesDir, "types", template, framework);
  await copy("**", root, {
    parents: true,
    cwd: templatePath,
    rename: assetRelocator,
  });

  const compPath = path.join(templatesDir, "components");
  const enginePath = path.join(root, "app", "engine");

  // Copy selected vector DB
  await copy("**", enginePath, {
    parents: true,
    cwd: path.join(compPath, "vectordbs", "python", vectorDb ?? "none"),
  });

  // Copy all loaders to enginePath
  const loaderPath = path.join(enginePath, "loaders");
  await copy("**", loaderPath, {
    parents: true,
    cwd: path.join(compPath, "loaders", "python"),
  });

  // Select and copy engine code based on data sources and tools
  let engine;
  tools = tools ?? [];
  if (dataSources.length > 0 && tools.length === 0) {
    console.log("\nNo tools selected - use optimized context chat engine\n");
    engine = "chat";
  } else {
    engine = "agent";
  }
  await copy("**", enginePath, {
    parents: true,
    cwd: path.join(compPath, "engines", "python", engine),
  });

  const addOnDependencies = dataSources
    .map((ds) => getAdditionalDependencies(modelConfig, vectorDb, ds, tools))
    .flat();

  if (observability === "opentelemetry") {
    addOnDependencies.push({
      name: "traceloop-sdk",
      version: "^0.15.11",
    });

    const templateObservabilityPath = path.join(
      templatesDir,
      "components",
      "observability",
      "python",
      "opentelemetry",
    );
    await copy("**", path.join(root, "app"), {
      cwd: templateObservabilityPath,
    });
  }

  await addDependencies(root, addOnDependencies);

  if (postInstallAction === "runApp" || postInstallAction === "dependencies") {
    installPythonDependencies();
  }

  // Copy deployment files for python
  await copy("**", root, {
    cwd: path.join(compPath, "deployments", "python"),
  });
};

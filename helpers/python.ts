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
  TemplateType,
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
  dataSources?: TemplateDataSource[],
  tools?: Tool[],
  templateType?: TemplateType,
) => {
  const dependencies: Dependency[] = [];

  // Add vector db dependencies
  switch (vectorDb) {
    case "mongo": {
      dependencies.push({
        name: "llama-index-vector-stores-mongodb",
        version: "^0.3.1",
      });
      break;
    }
    case "pg": {
      dependencies.push({
        name: "llama-index-vector-stores-postgres",
        version: "^0.2.5",
      });
      break;
    }
    case "pinecone": {
      dependencies.push({
        name: "llama-index-vector-stores-pinecone",
        version: "^0.2.1",
      });
      break;
    }
    case "milvus": {
      dependencies.push({
        name: "llama-index-vector-stores-milvus",
        version: "^0.2.0",
      });
      dependencies.push({
        name: "pymilvus",
        version: "2.4.4",
      });
      break;
    }
    case "astra": {
      dependencies.push({
        name: "llama-index-vector-stores-astra-db",
        version: "^0.2.0",
      });
      break;
    }
    case "qdrant": {
      dependencies.push({
        name: "llama-index-vector-stores-qdrant",
        version: "^0.3.0",
      });
      break;
    }
    case "chroma": {
      dependencies.push({
        name: "llama-index-vector-stores-chroma",
        version: "^0.2.0",
      });
      break;
    }
    case "weaviate": {
      dependencies.push({
        name: "llama-index-vector-stores-weaviate",
        version: "^1.1.1",
      });
      break;
    }
  }

  // Add data source dependencies
  if (dataSources) {
    for (const ds of dataSources) {
      const dsType = ds?.type;
      switch (dsType) {
        case "file":
          dependencies.push({
            name: "docx2txt",
            version: "^0.8",
          });
          break;
        case "web":
          dependencies.push({
            name: "llama-index-readers-web",
            version: "^0.2.2",
          });
          break;
        case "db":
          dependencies.push({
            name: "llama-index-readers-database",
            version: "^0.2.0",
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
        case "llamacloud":
          dependencies.push({
            name: "llama-index-indices-managed-llama-cloud",
            version: "^0.3.1",
          });
          break;
      }
    }
  }

  // Add tools dependencies
  console.log("Adding tools dependencies");
  tools?.forEach((tool) => {
    tool.dependencies?.forEach((dep) => {
      dependencies.push(dep);
    });
  });

  switch (modelConfig.provider) {
    case "ollama":
      dependencies.push({
        name: "llama-index-llms-ollama",
        version: "0.3.0",
      });
      dependencies.push({
        name: "llama-index-embeddings-ollama",
        version: "0.3.0",
      });
      break;
    case "openai":
      if (templateType !== "multiagent") {
        dependencies.push({
          name: "llama-index-llms-openai",
          version: "^0.2.0",
        });
        dependencies.push({
          name: "llama-index-embeddings-openai",
          version: "^0.2.3",
        });
        dependencies.push({
          name: "llama-index-agent-openai",
          version: "^0.3.0",
        });
      }
      break;
    case "groq":
      // Fastembed==0.2.0 does not support python3.13 at the moment
      // Fixed the python version less than 3.13
      dependencies.push({
        name: "python",
        version: "^3.11,<3.13",
      });
      dependencies.push({
        name: "llama-index-llms-groq",
        version: "0.2.0",
      });
      dependencies.push({
        name: "llama-index-embeddings-fastembed",
        version: "^0.2.0",
      });
      break;
    case "anthropic":
      // Fastembed==0.2.0 does not support python3.13 at the moment
      // Fixed the python version less than 3.13
      dependencies.push({
        name: "python",
        version: "^3.11,<3.13",
      });
      dependencies.push({
        name: "llama-index-llms-anthropic",
        version: "0.3.0",
      });
      dependencies.push({
        name: "llama-index-embeddings-fastembed",
        version: "^0.2.0",
      });
      break;
    case "gemini":
      dependencies.push({
        name: "llama-index-llms-gemini",
        version: "0.3.4",
      });
      dependencies.push({
        name: "llama-index-embeddings-gemini",
        version: "^0.2.0",
      });
      break;
    case "mistral":
      dependencies.push({
        name: "llama-index-llms-mistralai",
        version: "0.2.1",
      });
      dependencies.push({
        name: "llama-index-embeddings-mistralai",
        version: "0.2.0",
      });
      break;
    case "azure-openai":
      dependencies.push({
        name: "llama-index-llms-azure-openai",
        version: "0.2.0",
      });
      dependencies.push({
        name: "llama-index-embeddings-azure-openai",
        version: "0.2.4",
      });
      break;
    case "t-systems":
      dependencies.push({
        name: "llama-index-agent-openai",
        version: "0.3.0",
      });
      dependencies.push({
        name: "llama-index-llms-openai-like",
        version: "0.2.0",
      });
      break;
  }

  return dependencies;
};

const mergePoetryDependencies = (
  dependencies: Dependency[],
  existingDependencies: Record<string, Omit<Dependency, "name"> | string>,
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

    // Serialize separately only if extras are provided
    if (value.extras && value.extras.length > 0) {
      existingDependencies[dependency.name] = value;
    } else {
      // Otherwise, serialize just the version string
      existingDependencies[dependency.name] = value.version;
    }
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
  let templatePath;
  if (template === "extractor") {
    templatePath = path.join(templatesDir, "types", "extractor", framework);
  } else {
    templatePath = path.join(templatesDir, "types", "streaming", framework);
  }
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

  if (vectorDb !== "llamacloud") {
    // Copy all loaders to enginePath
    // Not needed for LlamaCloud as it has its own loaders
    const loaderPath = path.join(enginePath, "loaders");
    await copy("**", loaderPath, {
      parents: true,
      cwd: path.join(compPath, "loaders", "python"),
    });
  }

  // Copy settings.py to app
  await copy("**", path.join(root, "app"), {
    cwd: path.join(compPath, "settings", "python"),
  });

  // Copy services
  if (template == "streaming" || template == "multiagent") {
    await copy("**", path.join(root, "app", "api", "services"), {
      cwd: path.join(compPath, "services", "python"),
    });
  }
  // Copy engine code
  if (template === "streaming" || template === "multiagent") {
    // Select and copy engine code based on data sources and tools
    let engine;
    // Multiagent always uses agent engine
    if (template === "multiagent") {
      engine = "agent";
    } else {
      // For streaming, use chat engine by default
      // Unless tools are selected, in which case use agent engine
      if (dataSources.length > 0 && (!tools || tools.length === 0)) {
        console.log(
          "\nNo tools selected - use optimized context chat engine\n",
        );
        engine = "chat";
      } else {
        engine = "agent";
      }
    }

    // Copy engine code
    await copy("**", enginePath, {
      parents: true,
      cwd: path.join(compPath, "engines", "python", engine),
    });
  }

  if (template === "multiagent") {
    // Copy multi-agent code
    await copy("**", path.join(root), {
      parents: true,
      cwd: path.join(compPath, "multiagent", "python"),
      rename: assetRelocator,
    });
  }

  console.log("Adding additional dependencies");

  const addOnDependencies = getAdditionalDependencies(
    modelConfig,
    vectorDb,
    dataSources,
    tools,
    template,
  );

  if (observability && observability !== "none") {
    if (observability === "traceloop") {
      addOnDependencies.push({
        name: "traceloop-sdk",
        version: "^0.15.11",
      });
    }

    if (observability === "llamatrace") {
      addOnDependencies.push({
        name: "llama-index-callbacks-arize-phoenix",
        version: "^0.2.1",
      });
    }

    const templateObservabilityPath = path.join(
      templatesDir,
      "components",
      "observability",
      "python",
      observability,
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

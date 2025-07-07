import fs from "fs/promises";
import path from "path";
import { cyan, red } from "picocolors";
import { parse, stringify } from "smol-toml";
import terminalLink from "terminal-link";
import { isUvAvailable, tryUvSync } from "./uv";

import { assetRelocator, copy } from "./copy";
import { templatesDir } from "./dir";
import { InstallTemplateArgs } from "./types";

interface Dependency {
  name: string;
  version?: string;
  extras?: string[];
  constraints?: Record<string, string>;
}

const getAdditionalDependencies = (
  opts: Pick<
    InstallTemplateArgs,
    | "framework"
    | "template"
    | "useCase"
    | "modelConfig"
    | "vectorDb"
    | "dataSources"
  >,
) => {
  const { framework, template, useCase, modelConfig, vectorDb, dataSources } =
    opts;
  const isPythonLlamaDeploy =
    framework === "fastapi" && template === "llamaindexserver";
  const isPythonFinancialReport =
    isPythonLlamaDeploy && useCase === "financial_report";

  const dependencies: Dependency[] = [];

  if (isPythonFinancialReport) {
    dependencies.push(
      ...[
        {
          name: "e2b-code-interpreter",
          version: ">=1.1.1,<2.0.0",
        },
        {
          name: "markdown",
          version: ">=3.7,<4.0",
        },
        {
          name: "xhtml2pdf",
          version: ">=0.2.17,<1.0.0",
        },
      ],
    );
  }

  // Add vector db dependencies
  switch (vectorDb) {
    case "mongo": {
      dependencies.push({
        name: "llama-index-vector-stores-mongodb",
        version: ">=0.3.2,<0.4.0",
      });
      break;
    }
    case "pg": {
      dependencies.push({
        name: "llama-index-vector-stores-postgres",
        version: ">=0.3.2,<0.4.0",
      });
      break;
    }
    case "pinecone": {
      dependencies.push({
        name: "llama-index-vector-stores-pinecone",
        version: ">=0.4.1,<0.5.0",
        constraints: {
          python: ">=3.11,<3.13",
        },
      });
      break;
    }
    case "milvus": {
      dependencies.push({
        name: "llama-index-vector-stores-milvus",
        version: ">=0.3.0,<0.4.0",
      });
      dependencies.push({
        name: "pymilvus",
        version: ">=2.4.4,<3.0.0",
      });
      break;
    }
    case "astra": {
      dependencies.push({
        name: "llama-index-vector-stores-astra-db",
        version: ">=0.4.0,<0.5.0",
      });
      break;
    }
    case "qdrant": {
      dependencies.push({
        name: "llama-index-vector-stores-qdrant",
        version: ">=0.4.0,<0.5.0",
        constraints: {
          python: ">=3.11,<3.13",
        },
      });
      break;
    }
    case "chroma": {
      dependencies.push({
        name: "llama-index-vector-stores-chroma",
        version: ">=0.4.0,<0.5.0",
      });
      dependencies.push({
        name: "onnxruntime",
        version: "<1.22.0",
      });
      break;
    }
    case "weaviate": {
      dependencies.push({
        name: "llama-index-vector-stores-weaviate",
        version: ">=1.2.3,<2.0.0",
      });
      break;
    }
    case "llamacloud":
      dependencies.push({
        name: "llama-index-indices-managed-llama-cloud",
        version: ">=0.6.3,<0.7.0",
      });
      break;
  }

  // Add data source dependencies
  if (dataSources) {
    for (const ds of dataSources) {
      const dsType = ds?.type;
      switch (dsType) {
        case "file":
          dependencies.push({
            name: "docx2txt",
            version: ">=0.8,<0.9",
          });
          break;
        case "web":
          dependencies.push({
            name: "llama-index-readers-web",
            version: ">=0.3.0,<0.4.0",
          });
          break;
        case "db":
          dependencies.push({
            name: "llama-index-readers-database",
            version: ">=0.3.0,<0.4.0",
          });
          dependencies.push({
            name: "pymysql",
            version: ">=1.1.0,<2.0.0",
            extras: ["rsa"],
          });
          dependencies.push({
            name: "psycopg2-binary",
            version: ">=2.9.9,<3.0.0",
          });
          break;
      }
    }
  }

  switch (modelConfig.provider) {
    case "ollama":
      dependencies.push({
        name: "llama-index-llms-ollama",
        version: ">=0.5.0,<0.6.0",
      });
      dependencies.push({
        name: "llama-index-embeddings-ollama",
        version: ">=0.6.0,<0.7.0",
      });
      break;
    case "openai":
      dependencies.push({
        name: "llama-index-llms-openai",
        version: ">=0.3.2,<0.4.0",
      });
      dependencies.push({
        name: "llama-index-embeddings-openai",
        version: ">=0.3.1,<0.4.0",
      });
      break;
    case "groq":
      dependencies.push({
        name: "llama-index-llms-groq",
        version: ">=0.3.0,<0.4.0",
      });
      dependencies.push({
        name: "llama-index-embeddings-fastembed",
        version: ">=0.3.0,<0.4.0",
      });
      break;
    case "anthropic":
      dependencies.push({
        name: "llama-index-llms-anthropic",
        version: ">=0.6.0,<0.7.0",
      });
      dependencies.push({
        name: "llama-index-embeddings-fastembed",
        version: ">=0.3.0,<0.4.0",
      });
      break;
    case "gemini":
      dependencies.push({
        name: "llama-index-llms-google-genai",
        version: ">=0.2.0,<0.3.0",
      });
      dependencies.push({
        name: "llama-index-embeddings-google-genai",
        version: ">=0.2.0,<0.3.0",
      });
      break;
    case "mistral":
      dependencies.push({
        name: "llama-index-llms-mistralai",
        version: ">=0.4.0,<0.5.0",
      });
      dependencies.push({
        name: "llama-index-embeddings-mistralai",
        version: ">=0.3.0,<0.4.0",
      });
      break;
    case "azure-openai":
      dependencies.push({
        name: "llama-index-llms-azure-openai",
        version: ">=0.3.0,<0.4.0",
      });
      dependencies.push({
        name: "llama-index-embeddings-azure-openai",
        version: ">=0.3.0,<0.4.0",
      });
      break;
    case "huggingface":
      dependencies.push({
        name: "llama-index-llms-huggingface",
        version: ">=0.5.0,<0.6.0",
      });
      dependencies.push({
        name: "llama-index-embeddings-huggingface",
        version: ">=0.5.0,<0.6.0",
      });
      dependencies.push({
        name: "optimum",
        version: ">=1.23.3,<2.0.0",
        extras: ["onnxruntime"],
      });
      break;
    case "t-systems":
      dependencies.push({
        name: "llama-index-agent-openai",
        version: ">=0.4.0,<0.5.0",
      });
      dependencies.push({
        name: "llama-index-llms-openai-like",
        version: ">=0.3.0,<0.4.0",
      });
      break;
  }

  // If app template is llama-index-server and CI and SERVER_PACKAGE_PATH is set,
  // add @llamaindex/server to dependencies
  if (process.env.SERVER_PACKAGE_PATH) {
    dependencies.push({
      name: "llama-index-server",
      version: `@file://${process.env.SERVER_PACKAGE_PATH}`,
    });
  }

  return dependencies;
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
    let fileParsed: any;
    try {
      fileParsed = parse(fileContent);
    } catch (parseError) {
      console.error(`Error parsing ${FILENAME}:`, parseError);
      throw new Error(
        `Failed to parse ${FILENAME}. Please ensure it's valid TOML.`,
      );
    }

    // Ensure [project] and [project.dependencies] exist
    if (!fileParsed.project) {
      fileParsed.project = {};
    }
    if (
      !fileParsed.project.dependencies ||
      !Array.isArray(fileParsed.project.dependencies)
    ) {
      // If dependencies exist but aren't an array, log a warning or error.
      // For now, we'll overwrite it, assuming the intent is to use the standard array format.
      console.warn(
        `[project.dependencies] in ${FILENAME} is not an array. It will be overwritten.`,
      );
      fileParsed.project.dependencies = [];
    }

    const existingDependencies: string[] = fileParsed.project.dependencies;
    const addedDeps: string[] = [];
    const updatedDeps: string[] = [];

    // Add or update dependencies
    for (const newDep of dependencies) {
      let depString = newDep.name;
      if (newDep.extras && newDep.extras.length > 0) {
        depString += `[${newDep.extras.join(",")}]`;
      }
      if (newDep.version) {
        depString += newDep.version;
      }

      let found = false;
      for (let i = 0; i < existingDependencies.length; i++) {
        const existingDepNameMatch =
          existingDependencies[i].match(/^([a-zA-Z0-9._-]+)/);
        if (
          existingDepNameMatch &&
          existingDepNameMatch[1].toLowerCase() === depString.toLowerCase()
        ) {
          // Found existing dependency, update it
          if (existingDependencies[i] !== depString) {
            updatedDeps.push(`${existingDependencies[i]} -> ${depString}`);
            existingDependencies[i] = depString;
          }
          found = true;
          break;
        }
      }

      if (!found) {
        // Add new dependency
        existingDependencies.push(depString);
        addedDeps.push(depString);
      }
      // Handle python version constraints separately (if any)
      if (newDep.constraints?.python) {
        if (
          !fileParsed.project["requires-python"] ||
          fileParsed.project["requires-python"] !== newDep.constraints.python
        ) {
          // This simple overwrite might not be ideal; merging constraints is complex.
          // For now, let's just set it if the new dependency has one.
          console.log(
            `Setting requires-python = "${newDep.constraints.python}" from dependency ${newDep.name}`,
          );
          fileParsed.project["requires-python"] = newDep.constraints.python;
        }
      }
    }

    // Write toml file
    const newFileContent = stringify(fileParsed);
    await fs.writeFile(file, newFileContent);

    if (addedDeps.length > 0) {
      console.log(`\nAdded dependencies to ${cyan(FILENAME)}:`);
      addedDeps.forEach((dep) => console.log(`  ${dep}`));
    }
    if (updatedDeps.length > 0) {
      console.log(`\nUpdated dependencies in ${cyan(FILENAME)}:`);
      updatedDeps.forEach((dep) => console.log(`  ${dep}`));
    }
    if (addedDeps.length > 0 || updatedDeps.length > 0) {
      console.log(""); // Newline for spacing
    }
  } catch (error) {
    console.log(
      `Error while updating dependencies for Poetry project file ${FILENAME}\n`,
      error,
    );
  }
};

export const installPythonDependencies = () => {
  if (isUvAvailable()) {
    console.log(
      `Installing Python dependencies using uv. This may take a while...`,
    );
    const installSuccessful = tryUvSync();
    if (!installSuccessful) {
      console.error(
        red(
          "Installing dependencies using uv failed. Please check the error log above and ensure uv is installed correctly.",
        ),
      );
      process.exit(1);
    }
  } else {
    console.error(
      red(
        `uv is not available in the current environment. Please check ${terminalLink(
          "uv Installation",
          `https://github.com/astral-sh/uv#installation`,
        )} to install uv first, then run create-llama again.`,
      ),
    );
    process.exit(1);
  }
};

const installLlamaIndexServerTemplate = async ({
  root,
  useCase,
  useLlamaParse,
  modelConfig,
}: Pick<
  InstallTemplateArgs,
  "root" | "useCase" | "useLlamaParse" | "modelConfig"
>) => {
  if (!useCase) {
    console.log(
      red(
        `There is no use case selected. Please pick a use case to use via --use-case flag.`,
      ),
    );
    process.exit(1);
  }

  /**
   * Python use-cases structure:
   * src/
   * ├── workflow.py
   * ├── settings.py
   * ├── index.py
   * ├── generate.py
   * ├── ... (other utility files)
   * ui/
   * ├── index.ts
   * └── package.json
   * ├── components/*.tsx
   * ├── layout/*.tsx
   * llama_deploy.yaml
   * pyproject.toml
   * README.md
   */

  const srcDir = path.join(root, "src");
  const uiDir = path.join(root, "ui");

  // copy workflow code to src folder
  await copy("*.py", srcDir, {
    parents: true,
    cwd: path.join(templatesDir, "components", "use-cases", "python", useCase),
  });

  // copy model provider settings to src folder
  await copy("**", srcDir, {
    cwd: path.join(
      templatesDir,
      "components",
      "providers",
      "python",
      modelConfig.provider,
    ),
  });

  // copy ts server to ui folder
  await copy("**", uiDir, {
    parents: true,
    cwd: path.join(templatesDir, "components", "ts-proxy"),
  });

  // Copy custom UI components to ui/components folder
  await copy(`*`, path.join(uiDir, "components"), {
    parents: true,
    cwd: path.join(templatesDir, "components", "ui", "use-cases", useCase),
  });

  // Copy layout components to ui/layout folder
  await copy("*", path.join(uiDir, "layout"), {
    parents: true,
    cwd: path.join(templatesDir, "components", "ui", "layout"),
  });

  if (useLlamaParse) {
    await copy("index.py", srcDir, {
      parents: true,
      cwd: path.join(
        templatesDir,
        "components",
        "vectordbs",
        "llamaindexserver",
        "llamacloud",
        "python",
      ),
    });
    // TODO: Consider moving generate.py to app folder.
    await copy("generate.py", srcDir, {
      parents: true,
      cwd: path.join(
        templatesDir,
        "components",
        "vectordbs",
        "llamaindexserver",
        "llamacloud",
        "python",
      ),
    });
  }
  // Copy README.md
  await copy("README-template.md", path.join(root), {
    parents: true,
    cwd: path.join(templatesDir, "components", "use-cases", "python", useCase),
    rename: assetRelocator,
  });
};

export const installPythonTemplate = async ({
  appName,
  root,
  template,
  framework,
  vectorDb,
  postInstallAction,
  modelConfig,
  dataSources,
  useLlamaParse,
  useCase,
}: Pick<
  InstallTemplateArgs,
  | "appName"
  | "root"
  | "template"
  | "framework"
  | "vectorDb"
  | "postInstallAction"
  | "modelConfig"
  | "dataSources"
  | "useLlamaParse"
  | "useCase"
>) => {
  console.log("\nInitializing Python project with template:", template, "\n");
  const templatePath = path.join(templatesDir, "types", template, framework);
  await copy("**", root, {
    parents: true,
    cwd: templatePath,
    rename: assetRelocator,
  });

  if (template === "llamaindexserver") {
    await installLlamaIndexServerTemplate({
      root,
      useCase,
      useLlamaParse,
      modelConfig,
    });
  } else {
    throw new Error(`Template ${template} not supported`);
  }

  console.log("Adding additional dependencies");
  const addOnDependencies = getAdditionalDependencies({
    framework,
    template,
    useCase,
    modelConfig,
    vectorDb,
    dataSources,
  });

  await addDependencies(root, addOnDependencies);

  if (postInstallAction === "runApp" || postInstallAction === "dependencies") {
    installPythonDependencies();
  }
};

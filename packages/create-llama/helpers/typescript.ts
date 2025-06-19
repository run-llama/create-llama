import fs from "fs/promises";
import os from "os";
import path from "path";
import { bold, cyan, red } from "picocolors";
import { assetRelocator, copy } from "../helpers/copy";
import { callPackageManager } from "../helpers/install";
import { templatesDir } from "./dir";
import { PackageManager } from "./get-pkg-manager";
import { InstallTemplateArgs, ModelProvider, TemplateVectorDB } from "./types";

const installLlamaIndexServerTemplate = async ({
  root,
  useCase,
  vectorDb,
  modelConfig,
  dataSources,
}: Pick<
  InstallTemplateArgs,
  "root" | "useCase" | "vectorDb" | "modelConfig" | "dataSources"
>) => {
  if (!useCase) {
    console.log(
      red(
        `There is no use case selected. Please pick a use case to use via --use-case flag.`,
      ),
    );
    process.exit(1);
  }

  if (!vectorDb) {
    console.log(
      red(
        `There is no vector db selected. Please pick a vector db to use via --vector-db flag.`,
      ),
    );
    process.exit(1);
  }

  // copy model provider settings to app folder
  await copy("**", path.join(root, "src", "app"), {
    cwd: path.join(
      templatesDir,
      "components",
      "providers",
      "typescript",
      modelConfig.provider,
    ),
  });

  await copy("**", path.join(root), {
    cwd: path.join(
      templatesDir,
      "components",
      "use-cases",
      "typescript",
      useCase,
    ),
    rename: assetRelocator,
  });

  // copy workflow UI components to components folder in root
  await copy("*", path.join(root, "components"), {
    parents: true,
    cwd: path.join(templatesDir, "components", "ui", "use-cases", useCase),
  });

  // copy layout components to layout folder in root
  await copy("*", path.join(root, "layout"), {
    parents: true,
    cwd: path.join(templatesDir, "components", "ui", "layout"),
  });

  // Override generate.ts if workflow use case doesn't use custom UI
  if (vectorDb === "llamacloud") {
    await copy("**", path.join(root, "src"), {
      parents: true,
      cwd: path.join(
        templatesDir,
        "components",
        "vectordbs",
        "llamaindexserver",
        "llamacloud",
        "typescript",
      ),
    });
  }

  // Simplify use case code
  if (vectorDb === "none" && dataSources.length === 0) {
    // use case without data sources doesn't use index.
    // We don't need data.ts, generate.ts
    await fs.rm(path.join(root, "src", "app", "data.ts"));
    // TODO: split generate.ts into generate for index and generate for ui and remove generate for index here too
    // then we can also remove it for llamacloud
  }
};

/**
 * Install a LlamaIndex internal template to a given `root` directory.
 */
export const installTSTemplate = async ({
  appName,
  root,
  packageManager,
  template,
  framework,
  vectorDb,
  postInstallAction,
  dataSources,
  useCase,
  modelConfig,
}: InstallTemplateArgs) => {
  console.log(bold(`Using ${packageManager}.`));

  /**
   * Copy the template files to the target directory.
   */
  console.log("\nInitializing project with template:", template, "\n");
  const templatePath = path.join(templatesDir, "types", template, framework);
  const copySource = ["**"];

  await copy(copySource, root, {
    parents: true,
    cwd: templatePath,
    rename: assetRelocator,
  });

  if (template === "llamaindexserver") {
    await installLlamaIndexServerTemplate({
      root,
      useCase,
      vectorDb,
      modelConfig,
      dataSources,
    });
  } else {
    throw new Error(`Template ${template} not supported`);
  }

  const packageJson = await updatePackageJson({
    root,
    appName,
    vectorDb,
    modelConfig,
  });

  if (postInstallAction === "runApp" || postInstallAction === "dependencies") {
    await installTSDependencies(packageJson, packageManager, true);
  }
};

const providerDependencies: {
  [key in ModelProvider]?: Record<string, string>;
} = {
  openai: {
    "@llamaindex/openai": "~0.4.0",
  },
  gemini: {
    "@llamaindex/google": "^0.2.0",
  },
  ollama: {
    "@llamaindex/ollama": "^0.1.0",
  },
  mistral: {
    "@llamaindex/mistral": "^0.2.0",
  },
  "azure-openai": {
    "@llamaindex/openai": "^0.2.0",
  },
  groq: {
    "@llamaindex/groq": "^0.0.61",
    "@llamaindex/huggingface": "^0.1.0", // groq uses huggingface as default embedding model
  },
  anthropic: {
    "@llamaindex/anthropic": "^0.3.0",
    "@llamaindex/huggingface": "^0.1.0", // anthropic uses huggingface as default embedding model
  },
};

const vectorDbDependencies: Record<TemplateVectorDB, Record<string, string>> = {
  astra: {
    "@llamaindex/astra": "^0.0.5",
  },
  chroma: {
    "@llamaindex/chroma": "^0.0.5",
  },
  llamacloud: {},
  milvus: {
    "@zilliz/milvus2-sdk-node": "^2.4.6",
    "@llamaindex/milvus": "^0.1.0",
  },
  mongo: {
    mongodb: "6.7.0",
    "@llamaindex/mongodb": "^0.0.5",
  },
  none: {},
  pg: {
    pg: "^8.12.0",
    pgvector: "^0.2.0",
    "@llamaindex/postgres": "^0.0.33",
  },
  pinecone: {
    "@llamaindex/pinecone": "^0.0.5",
  },
  qdrant: {
    "@qdrant/js-client-rest": "^1.11.0",
    "@llamaindex/qdrant": "^0.1.0",
  },
  weaviate: {
    "@llamaindex/weaviate": "^0.0.5",
  },
};

async function updatePackageJson({
  root,
  appName,
  vectorDb,
  modelConfig,
}: Pick<
  InstallTemplateArgs,
  "root" | "appName" | "vectorDb" | "modelConfig"
>): Promise<any> {
  const packageJsonFile = path.join(root, "package.json");
  const packageJson: any = JSON.parse(
    await fs.readFile(packageJsonFile, "utf8"),
  );
  packageJson.name = appName;
  packageJson.version = "0.1.0";

  packageJson.dependencies = {
    ...packageJson.dependencies,
    "@llamaindex/readers": "~3.1.4",
  };

  if (vectorDb && vectorDb in vectorDbDependencies) {
    packageJson.dependencies = {
      ...packageJson.dependencies,
      ...vectorDbDependencies[vectorDb],
    };
  }

  if (modelConfig.provider && modelConfig.provider in providerDependencies) {
    packageJson.dependencies = {
      ...packageJson.dependencies,
      ...providerDependencies[modelConfig.provider],
    };
  }

  // if having custom server package tgz file, use it for testing @llamaindex/server
  const serverPackagePath = process.env.SERVER_PACKAGE_PATH;
  if (serverPackagePath) {
    const relativePath = path.relative(process.cwd(), serverPackagePath);
    packageJson.dependencies = {
      ...packageJson.dependencies,
      "@llamaindex/server": `file:${relativePath}`,
    };
  }

  await fs.writeFile(
    packageJsonFile,
    JSON.stringify(packageJson, null, 2) + os.EOL,
  );

  return packageJson;
}

async function installTSDependencies(
  packageJson: any,
  packageManager: PackageManager,
  isOnline: boolean,
): Promise<void> {
  console.log("\nInstalling dependencies:");
  for (const dependency in packageJson.dependencies)
    console.log(`- ${cyan(dependency)}`);

  console.log("\nInstalling devDependencies:");
  for (const dependency in packageJson.devDependencies)
    console.log(`- ${cyan(dependency)}`);

  console.log();

  await callPackageManager(packageManager, isOnline).catch((error) => {
    console.error("Failed to install TS dependencies. Exiting...");
    process.exit(1);
  });
}

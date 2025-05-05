import fs from "fs/promises";
import os from "os";
import path from "path";
import { bold, cyan, red, yellow } from "picocolors";
import { assetRelocator, copy } from "../helpers/copy";
import { callPackageManager } from "../helpers/install";
import { templatesDir } from "./dir";
import { PackageManager } from "./get-pkg-manager";
import { InstallTemplateArgs, ModelProvider, TemplateVectorDB } from "./types";

const installLlamaIndexServerTemplate = async ({
  root,
  useCase,
  vectorDb,
}: Pick<InstallTemplateArgs, "root" | "useCase" | "vectorDb">) => {
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

  await copy("*.ts", path.join(root, "src", "app"), {
    parents: true,
    cwd: path.join(
      templatesDir,
      "components",
      "workflows",
      "typescript",
      useCase,
    ),
  });

  // copy workflow UI components to output/components folder
  await copy("*", path.join(root, "components"), {
    parents: true,
    cwd: path.join(templatesDir, "components", "ui", "workflows", useCase),
  });

  if (vectorDb === "llamacloud") {
    await copy("generate.ts", path.join(root, "src"), {
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

    await copy("index.ts", path.join(root, "src", "app"), {
      parents: true,
      cwd: path.join(
        templatesDir,
        "components",
        "vectordbs",
        "llamaindexserver",
        "llamacloud",
        "typescript",
      ),
      rename: () => "data.ts",
    });
  }
  // Copy README.md
  await copy("README-template.md", path.join(root), {
    parents: true,
    cwd: path.join(
      templatesDir,
      "components",
      "workflows",
      "typescript",
      useCase,
    ),
    rename: assetRelocator,
  });
};

const installLegacyTSTemplate = async ({
  root,
  template,
  backend,
  framework,
  ui,
  vectorDb,
  observability,
  tools,
  dataSources,
  useLlamaParse,
  useCase,
  modelConfig,
  relativeEngineDestPath,
}: InstallTemplateArgs & {
  backend: boolean;
  relativeEngineDestPath: string;
}) => {
  /**
   * If next.js is used, update its configuration if necessary
   */
  if (framework === "nextjs") {
    const nextConfigJsonFile = path.join(root, "next.config.json");
    const nextConfigJson: any = JSON.parse(
      await fs.readFile(nextConfigJsonFile, "utf8"),
    );
    if (!backend) {
      // update next.config.json for static site generation
      nextConfigJson.output = "export";
      nextConfigJson.images = { unoptimized: true };
      console.log("\nUsing static site generation\n");
    } else {
      if (vectorDb === "milvus") {
        nextConfigJson.serverExternalPackages =
          nextConfigJson.serverExternalPackages ?? [];
        nextConfigJson.serverExternalPackages.push("@zilliz/milvus2-sdk-node");
      }
    }
    await fs.writeFile(
      nextConfigJsonFile,
      JSON.stringify(nextConfigJson, null, 2) + os.EOL,
    );

    const webpackConfigOtelFile = path.join(root, "webpack.config.o11y.mjs");
    if (observability === "traceloop") {
      const webpackConfigDefaultFile = path.join(root, "webpack.config.mjs");
      await fs.rm(webpackConfigDefaultFile);
      await fs.rename(webpackConfigOtelFile, webpackConfigDefaultFile);
    } else {
      await fs.rm(webpackConfigOtelFile);
    }
  }

  // copy observability component
  if (observability && observability !== "none") {
    const chosenObservabilityPath = path.join(
      templatesDir,
      "components",
      "observability",
      "typescript",
      observability,
    );
    const relativeObservabilityPath = framework === "nextjs" ? "app" : "src";

    await copy(
      "**",
      path.join(root, relativeObservabilityPath, "observability"),
      { cwd: chosenObservabilityPath },
    );
  }

  const compPath = path.join(templatesDir, "components");
  const enginePath = path.join(root, relativeEngineDestPath, "engine");

  // copy llamaindex code for TS templates
  await copy("**", path.join(root, relativeEngineDestPath, "llamaindex"), {
    parents: true,
    cwd: path.join(compPath, "llamaindex", "typescript"),
  });

  // copy vector db component
  if (vectorDb === "llamacloud") {
    console.log(
      `\nUsing managed index from LlamaCloud. Ensure the ${yellow("LLAMA_CLOUD_* environment variables are set correctly.")}`,
    );
  } else {
    console.log("\nUsing vector DB:", vectorDb ?? "none");
  }
  await copy("**", enginePath, {
    parents: true,
    cwd: path.join(compPath, "vectordbs", "typescript", vectorDb ?? "none"),
  });

  if (template === "multiagent") {
    const multiagentPath = path.join(compPath, "multiagent", "typescript");

    // copy workflow code for multiagent template
    await copy("**", path.join(root, relativeEngineDestPath, "workflow"), {
      parents: true,
      cwd: path.join(multiagentPath, "workflow"),
    });

    // Copy use case code for multiagent template
    if (useCase) {
      console.log("\nCopying use case:", useCase, "\n");
      const useCasePath = path.join(compPath, "agents", "typescript", useCase);
      const useCaseCodePath = path.join(useCasePath, "workflow");

      // Copy use case codes
      await copy("**", path.join(root, relativeEngineDestPath, "workflow"), {
        parents: true,
        cwd: useCaseCodePath,
        rename: assetRelocator,
      });

      // Copy use case files to project root
      await copy("*.*", path.join(root), {
        parents: true,
        cwd: useCasePath,
        rename: assetRelocator,
      });
    } else {
      console.log(
        red(
          `There is no use case selected for ${template} template. Please pick a use case to use via --use-case flag.`,
        ),
      );
      process.exit(1);
    }

    if (framework === "nextjs") {
      // patch route.ts file
      await copy("**", path.join(root, relativeEngineDestPath), {
        parents: true,
        cwd: path.join(multiagentPath, "nextjs"),
      });
    } else if (framework === "express") {
      // patch chat.controller.ts file
      await copy("**", path.join(root, relativeEngineDestPath), {
        parents: true,
        cwd: path.join(multiagentPath, "express"),
      });
    }
  }

  // copy loader component (TS only supports llama_parse and file for now)
  const loaderFolder = useLlamaParse ? "llama_parse" : "file";
  await copy("**", enginePath, {
    parents: true,
    cwd: path.join(compPath, "loaders", "typescript", loaderFolder),
  });

  // copy provider settings
  await copy("**", enginePath, {
    parents: true,
    cwd: path.join(compPath, "providers", "typescript", modelConfig.provider),
  });

  // Select and copy engine code based on data sources and tools
  let engine;
  tools = tools ?? [];
  // multiagent template always uses agent engine
  if (template === "multiagent") {
    engine = "agent";
  } else if (dataSources.length > 0 && tools.length === 0) {
    console.log("\nNo tools selected - use optimized context chat engine\n");
    engine = "chat";
  } else {
    engine = "agent";
  }
  await copy("**", enginePath, {
    parents: true,
    cwd: path.join(compPath, "engines", "typescript", engine),
  });

  // copy settings to engine folder
  await copy("**", enginePath, {
    cwd: path.join(compPath, "settings", "typescript"),
  });

  /**
   * Copy the selected UI files to the target directory and reference it.
   */
  if (framework === "nextjs" && ui !== "shadcn") {
    console.log("\nUsing UI:", ui, "\n");
    const uiPath = path.join(compPath, "ui", ui);
    const destUiPath = path.join(root, "app", "components", "ui");
    // remove the default ui folder
    await fs.rm(destUiPath, { recursive: true });
    // copy the selected ui folder
    await copy("**", destUiPath, {
      parents: true,
      cwd: uiPath,
      rename: assetRelocator,
    });
  }

  /** Modify frontend code to use custom API path */
  if (framework === "nextjs" && !backend) {
    console.log(
      "\nUsing external API for frontend, removing API code and configuration\n",
    );
    // remove the default api folder and config folder
    await fs.rm(path.join(root, "app", "api"), { recursive: true });
    await fs.rm(path.join(root, "config"), { recursive: true, force: true });
  }
};

/**
 * Install a LlamaIndex internal template to a given `root` directory.
 */
export const installTSTemplate = async ({
  appName,
  root,
  packageManager,
  isOnline,
  template,
  framework,
  ui,
  vectorDb,
  postInstallAction,
  backend,
  observability,
  tools,
  dataSources,
  useLlamaParse,
  useCase,
  modelConfig,
}: InstallTemplateArgs & { backend: boolean }) => {
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

  const relativeEngineDestPath =
    framework === "nextjs"
      ? path.join("app", "api", "chat")
      : path.join("src", "controllers");

  if (template === "llamaindexserver") {
    await installLlamaIndexServerTemplate({
      root,
      useCase,
      vectorDb,
    });
  } else {
    await installLegacyTSTemplate({
      appName,
      root,
      packageManager,
      isOnline,
      template,
      backend,
      framework,
      ui,
      vectorDb,
      observability,
      tools,
      dataSources,
      useLlamaParse,
      useCase,
      modelConfig,
      relativeEngineDestPath,
    });
  }

  const packageJson = await updatePackageJson({
    root,
    appName,
    dataSources,
    relativeEngineDestPath,
    framework,
    ui,
    observability,
    vectorDb,
    backend,
    modelConfig,
    template,
  });

  if (
    backend &&
    (postInstallAction === "runApp" || postInstallAction === "dependencies")
  ) {
    await installTSDependencies(packageJson, packageManager, isOnline);
  }
};

const providerDependencies: {
  [key in ModelProvider]?: Record<string, string>;
} = {
  openai: {
    "@llamaindex/openai": "^0.2.0",
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
  dataSources,
  relativeEngineDestPath,
  framework,
  ui,
  observability,
  vectorDb,
  backend,
  modelConfig,
  template,
}: Pick<
  InstallTemplateArgs,
  | "root"
  | "appName"
  | "dataSources"
  | "framework"
  | "ui"
  | "observability"
  | "vectorDb"
  | "modelConfig"
  | "template"
> & {
  relativeEngineDestPath: string;
  backend: boolean;
}): Promise<any> {
  const packageJsonFile = path.join(root, "package.json");
  const packageJson: any = JSON.parse(
    await fs.readFile(packageJsonFile, "utf8"),
  );
  packageJson.name = appName;
  packageJson.version = "0.1.0";

  if (relativeEngineDestPath && template !== "llamaindexserver") {
    // TODO: move script to {root}/scripts for all frameworks
    // add generate script if using context engine
    packageJson.scripts = {
      ...packageJson.scripts,
      generate: `tsx ${path.join(
        relativeEngineDestPath,
        "engine",
        "generate.ts",
      )}`,
    };
  }

  if (framework === "nextjs" && ui === "html") {
    // remove shadcn dependencies if html ui is selected
    packageJson.dependencies = {
      ...packageJson.dependencies,
      "tailwind-merge": undefined,
      "@radix-ui/react-slot": undefined,
      "class-variance-authority": undefined,
      clsx: undefined,
      "lucide-react": undefined,
      remark: undefined,
      "remark-code-import": undefined,
      "remark-gfm": undefined,
      "remark-math": undefined,
      "react-markdown": undefined,
      "highlight.js": undefined,
    };
  }

  if (backend) {
    packageJson.dependencies = {
      ...packageJson.dependencies,
      "@llamaindex/readers": "^2.0.0",
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
  }

  if (observability === "traceloop") {
    packageJson.dependencies = {
      ...packageJson.dependencies,
      "@traceloop/node-server-sdk": "^0.5.19",
    };

    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      "node-loader": "^2.0.0",
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

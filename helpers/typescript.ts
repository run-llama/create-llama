import fs from "fs/promises";
import os from "os";
import path from "path";
import { bold, cyan, red, yellow } from "picocolors";
import { assetRelocator, copy } from "../helpers/copy";
import { callPackageManager } from "../helpers/install";
import { templatesDir } from "./dir";
import { PackageManager } from "./get-pkg-manager";
import { InstallTemplateArgs } from "./types";

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
  agents,
}: InstallTemplateArgs & { backend: boolean }) => {
  console.log(bold(`Using ${packageManager}.`));

  /**
   * Copy the template files to the target directory.
   */
  console.log("\nInitializing project with template:", template, "\n");
  const templatePath = path.join(templatesDir, "types", "streaming", framework);
  const copySource = ["**"];

  await copy(copySource, root, {
    parents: true,
    cwd: templatePath,
    rename: assetRelocator,
  });

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
  const relativeEngineDestPath =
    framework === "nextjs"
      ? path.join("app", "api", "chat")
      : path.join("src", "controllers");
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

    // Copy agents use case code for multiagent template
    if (agents) {
      console.log("\nCopying agent:", agents, "\n");
      const useCasePath = path.join(compPath, "agents", "typescript", agents);
      const agentsCodePath = path.join(useCasePath, "workflow");

      // Copy agent codes
      await copy("**", path.join(root, relativeEngineDestPath, "workflow"), {
        parents: true,
        cwd: agentsCodePath,
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
          "There is no agent selected for multi-agent template. Please pick an agent to use via --agents flag.",
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

  const packageJson = await updatePackageJson({
    root,
    appName,
    dataSources,
    relativeEngineDestPath,
    framework,
    ui,
    observability,
    vectorDb,
  });

  if (postInstallAction === "runApp" || postInstallAction === "dependencies") {
    await installTSDependencies(packageJson, packageManager, isOnline);
  }

  // Copy deployment files for typescript
  await copy("**", root, {
    cwd: path.join(compPath, "deployments", "typescript"),
  });
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
}: Pick<
  InstallTemplateArgs,
  | "root"
  | "appName"
  | "dataSources"
  | "framework"
  | "ui"
  | "observability"
  | "vectorDb"
> & {
  relativeEngineDestPath: string;
}): Promise<any> {
  const packageJsonFile = path.join(root, "package.json");
  const packageJson: any = JSON.parse(
    await fs.readFile(packageJsonFile, "utf8"),
  );
  packageJson.name = appName;
  packageJson.version = "0.1.0";

  if (relativeEngineDestPath) {
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

  if (vectorDb === "pg") {
    packageJson.dependencies = {
      ...packageJson.dependencies,
      pg: "^8.12.0",
      pgvector: "^0.2.0",
    };
  }

  if (vectorDb === "qdrant") {
    packageJson.dependencies = {
      ...packageJson.dependencies,
      "@qdrant/js-client-rest": "^1.11.0",
    };
  }
  if (vectorDb === "mongo") {
    packageJson.dependencies = {
      ...packageJson.dependencies,
      mongodb: "^6.7.0",
    };
  }

  if (vectorDb === "milvus") {
    packageJson.dependencies = {
      ...packageJson.dependencies,
      "@zilliz/milvus2-sdk-node": "^2.4.6",
    };
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

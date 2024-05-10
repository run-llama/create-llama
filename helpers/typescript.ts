import fs from "fs/promises";
import os from "os";
import path from "path";
import { bold, cyan } from "picocolors";
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
        nextConfigJson.experimental.serverComponentsExternalPackages =
          nextConfigJson.experimental.serverComponentsExternalPackages ?? [];
        nextConfigJson.experimental.serverComponentsExternalPackages.push(
          "@zilliz/milvus2-sdk-node",
        );
      }
    }
    await fs.writeFile(
      nextConfigJsonFile,
      JSON.stringify(nextConfigJson, null, 2) + os.EOL,
    );

    const webpackConfigOtelFile = path.join(root, "webpack.config.o11y.mjs");
    if (observability === "opentelemetry") {
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

  // copy vector db component
  console.log("\nUsing vector DB:", vectorDb ?? "none", "\n");
  await copy("**", enginePath, {
    parents: true,
    cwd: path.join(compPath, "vectordbs", "typescript", vectorDb ?? "none"),
  });

  // copy loader component (TS only supports llama_parse and file for now)
  const loaderFolder = useLlamaParse ? "llama_parse" : "file";
  await copy("**", enginePath, {
    parents: true,
    cwd: path.join(compPath, "loaders", "typescript", loaderFolder),
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
    cwd: path.join(compPath, "engines", "typescript", engine),
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
}: Pick<
  InstallTemplateArgs,
  "root" | "appName" | "dataSources" | "framework" | "ui" | "observability"
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
      "react-syntax-highlighter": undefined,
    };

    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      "@types/react-syntax-highlighter": undefined,
    };
  }

  if (observability === "opentelemetry") {
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

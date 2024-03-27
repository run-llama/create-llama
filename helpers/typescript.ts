import fs from "fs/promises";
import os from "os";
import path from "path";
import { bold, cyan } from "picocolors";
import { copy } from "../helpers/copy";
import { callPackageManager } from "../helpers/install";
import { templatesDir } from "./dir";
import { PackageManager } from "./get-pkg-manager";
import { makeDir } from "./make-dir";
import { InstallTemplateArgs } from "./types";

const rename = (name: string) => {
  switch (name) {
    case "gitignore":
    case "eslintrc.json": {
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
};

export const installTSDependencies = async (
  packageJson: any,
  packageManager: PackageManager,
  isOnline: boolean,
): Promise<void> => {
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
  customApiPath,
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
    rename,
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

  /**
   * Copy the selected chat engine files to the target directory and reference it.
   */
  const compPath = path.join(templatesDir, "components");
  const relativeEngineDestPath =
    framework === "nextjs"
      ? path.join("app", "api", "chat")
      : path.join("src", "controllers");
  const enginePath = path.join(root, relativeEngineDestPath, "engine");

  if (dataSources.length === 0) {
    // use simple hat engine if user neither select tools nor a data source
    console.log("\nUsing simple chat engine\n");
  } else {
    if (vectorDb) {
      // copy vector db component
      console.log("\nUsing vector DB:", vectorDb, "\n");
      const vectorDBPath = path.join(
        compPath,
        "vectordbs",
        "typescript",
        vectorDb,
      );
      await copy("**", enginePath, {
        parents: true,
        cwd: vectorDBPath,
      });
    }
    // copy loader component (TS only supports llama_parse and file for now)
    let loaderFolder: string;
    loaderFolder = useLlamaParse ? "llama_parse" : "file";
    await copy("**", enginePath, {
      parents: true,
      cwd: path.join(compPath, "loaders", "typescript", loaderFolder),
    });
    if (tools?.length) {
      // use agent chat engine if user selects tools
      console.log("\nUsing agent chat engine\n");
      await copy("**", enginePath, {
        parents: true,
        cwd: path.join(compPath, "engines", "typescript", "agent"),
      });

      // Write config/tools.json
      const configContent: Record<string, any> = {};
      tools.forEach((tool) => {
        configContent[tool.name] = tool.config ?? {};
      });
      const configPath = path.join(root, "config");
      await makeDir(configPath);
      await fs.writeFile(
        path.join(configPath, "tools.json"),
        JSON.stringify(configContent, null, 2),
      );
    } else {
      // use context chat engine if user does not select tools
      console.log("\nUsing context chat engine\n");
      await copy("**", enginePath, {
        parents: true,
        cwd: path.join(compPath, "engines", "typescript", "chat"),
      });
    }
  }

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
      rename,
    });
  }

  /**
   * Update the package.json scripts.
   */
  const packageJsonFile = path.join(root, "package.json");
  const packageJson: any = JSON.parse(
    await fs.readFile(packageJsonFile, "utf8"),
  );
  packageJson.name = appName;
  packageJson.version = "0.1.0";

  if (framework === "nextjs" && customApiPath) {
    console.log(
      "\nUsing external API with custom API path:",
      customApiPath,
      "\n",
    );
    // remove the default api folder
    const apiPath = path.join(root, "app", "api");
    await fs.rm(apiPath, { recursive: true });
    // modify the dev script to use the custom api path
  }

  if (dataSources.length > 0 && relativeEngineDestPath) {
    // add generate script if using context engine
    packageJson.scripts = {
      ...packageJson.scripts,
      generate: `node ${path.join(
        relativeEngineDestPath,
        "engine",
        "generate.mjs",
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

  if (postInstallAction === "runApp" || postInstallAction === "dependencies") {
    await installTSDependencies(packageJson, packageManager, isOnline);
  }

  // Copy deployment files for typescript
  await copy("**", root, {
    cwd: path.join(compPath, "deployments", "typescript"),
  });
};

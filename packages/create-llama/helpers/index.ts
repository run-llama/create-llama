import { callPackageManager } from "./install";

import path from "path";
import picocolors, { cyan } from "picocolors";

import fsExtra from "fs-extra";
import { createBackendEnvFile } from "./env-variables";
import { PackageManager } from "./get-pkg-manager";
import { makeDir } from "./make-dir";
import { installPythonTemplate } from "./python";
import {
  FileSourceConfig,
  InstallTemplateArgs,
  ModelConfig,
  TemplateDataSource,
  TemplateFramework,
  TemplateVectorDB,
} from "./types";
import { installTSTemplate } from "./typescript";
import { isHavingUvLockFile, tryUvRun } from "./uv";

const checkForGenerateScript = (
  modelConfig: ModelConfig,
  vectorDb?: TemplateVectorDB,
  llamaCloudKey?: string,
  useLlamaParse?: boolean,
) => {
  const missingSettings = [];

  if (!modelConfig.isConfigured()) {
    missingSettings.push("your model provider API key");
  }

  const llamaCloudApiKey = llamaCloudKey ?? process.env["LLAMA_CLOUD_API_KEY"];
  const isRequiredLlamaCloudKey = useLlamaParse || vectorDb === "llamacloud";
  if (isRequiredLlamaCloudKey && !llamaCloudApiKey) {
    missingSettings.push("your LLAMA_CLOUD_API_KEY");
  }

  if (
    vectorDb !== undefined &&
    vectorDb !== "none" &&
    vectorDb !== "llamacloud"
  ) {
    missingSettings.push("your Vector DB environment variables");
  }

  return missingSettings;
};

// eslint-disable-next-line max-params
async function generateContextData(
  framework: TemplateFramework,
  modelConfig: ModelConfig,
  dataSources: TemplateDataSource[],
  packageManager?: PackageManager,
  vectorDb?: TemplateVectorDB,
  llamaCloudKey?: string,
  useLlamaParse?: boolean,
) {
  if (packageManager) {
    const runGenerate = `${cyan(
      framework === "fastapi"
        ? "uv run generate"
        : `${packageManager} run generate`,
    )}`;

    const missingSettings = checkForGenerateScript(
      modelConfig,
      vectorDb,
      llamaCloudKey,
      useLlamaParse,
    );

    if (!missingSettings.length) {
      // If all the required environment variables are set, run the generate script
      if (framework === "fastapi") {
        if (isHavingUvLockFile()) {
          console.log(`Running ${runGenerate} to generate the context data.`);
          const result = tryUvRun("generate");
          if (!result) {
            console.log(`Failed to run ${runGenerate}.`);
            process.exit(1);
          }
          console.log(`Generated context data`);
          return;
        } else {
          console.log(
            picocolors.yellow(
              `\nWarning: uv.lock not found. Dependency installation might be incomplete. Skipping context generation.\nIf dependencies were installed, try running '${runGenerate}' manually.\n`,
            ),
          );
        }
      } else {
        console.log(`Running ${runGenerate} to generate the context data.`);

        const shouldRunGenerate = dataSources.length > 0;

        if (shouldRunGenerate) {
          await callPackageManager(packageManager, true, ["run", "generate"]);
        }
        return;
      }
    }

    const settingsMessage = `After setting ${missingSettings.join(" and ")}, run ${runGenerate} to generate the context data.`;
    console.log(picocolors.yellow(`\n${settingsMessage}\n\n`));
  }
}

const downloadFile = async (url: string, destPath: string) => {
  const response = await fetch(url);
  const fileBuffer = await response.arrayBuffer();
  await fsExtra.writeFile(destPath, new Uint8Array(fileBuffer));
};

const prepareContextData = async (
  root: string,
  dataSources: TemplateDataSource[],
) => {
  await makeDir(path.join(root, "data"));
  for (const dataSource of dataSources) {
    const dataSourceConfig = dataSource?.config as FileSourceConfig;
    // If the path is URLs, download the data and save it to the data directory
    if ("url" in dataSourceConfig) {
      console.log(
        "Downloading file from URL:",
        dataSourceConfig.url.toString(),
      );
      const destPath = path.join(
        root,
        "data",
        dataSourceConfig.filename ??
          path.basename(dataSourceConfig.url.toString()),
      );
      await downloadFile(dataSourceConfig.url.toString(), destPath);
    } else {
      // Copy local data
      console.log("Copying data from path:", dataSourceConfig.path);
      const destPath = path.join(
        root,
        "data",
        path.basename(dataSourceConfig.path),
      );
      await fsExtra.copy(dataSourceConfig.path, destPath);
    }
  }
};

export const installTemplate = async (props: InstallTemplateArgs) => {
  process.chdir(props.root);

  if (props.framework === "fastapi") {
    await installPythonTemplate(props);
  } else {
    await installTSTemplate(props);
  }

  // This is a backend, so we need to copy the test data and create the env file.

  // Copy the environment file to the target directory.
  await createBackendEnvFile(props.root, props);

  await prepareContextData(
    props.root,
    props.dataSources.filter((ds) => ds.type === "file"),
  );

  if (
    props.dataSources.length > 0 &&
    (props.postInstallAction === "runApp" ||
      props.postInstallAction === "dependencies")
  ) {
    console.log("\nGenerating context data...\n");
    await generateContextData(
      props.framework,
      props.modelConfig,
      props.dataSources,
      props.packageManager,
      props.vectorDb,
      props.llamaCloudKey,
      props.useLlamaParse,
    );
  }

  // Create outputs directory
  await makeDir(path.join(props.root, "output/tools"));
  await makeDir(path.join(props.root, "output/uploaded"));
  await makeDir(path.join(props.root, "output/llamacloud"));
};

export * from "./types";

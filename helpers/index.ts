import { callPackageManager } from "./install";

import path from "path";
import { cyan } from "picocolors";

import fsExtra from "fs-extra";
import { writeLoadersConfig } from "./datasources";
import { createBackendEnvFile, createFrontendEnvFile } from "./env-variables";
import { PackageManager } from "./get-pkg-manager";
import { installLlamapackProject } from "./llama-pack";
import { makeDir } from "./make-dir";
import { isHavingPoetryLockFile, tryPoetryRun } from "./poetry";
import { installPythonTemplate } from "./python";
import { downloadAndExtractRepo } from "./repo";
import { ConfigFileType, writeToolsConfig } from "./tools";
import {
  FileSourceConfig,
  InstallTemplateArgs,
  ModelConfig,
  TemplateDataSource,
  TemplateFramework,
  TemplateVectorDB,
} from "./types";
import { installTSTemplate } from "./typescript";

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

  if (vectorDb !== "none" && vectorDb !== "llamacloud") {
    missingSettings.push("your Vector DB environment variables");
  }

  return missingSettings;
};

// eslint-disable-next-line max-params
async function generateContextData(
  framework: TemplateFramework,
  modelConfig: ModelConfig,
  packageManager?: PackageManager,
  vectorDb?: TemplateVectorDB,
  llamaCloudKey?: string,
  useLlamaParse?: boolean,
) {
  if (packageManager) {
    const runGenerate = `${cyan(
      framework === "fastapi"
        ? "poetry run generate"
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
        if (isHavingPoetryLockFile()) {
          console.log(`Running ${runGenerate} to generate the context data.`);
          const result = tryPoetryRun("poetry run generate");
          if (!result) {
            console.log(`Failed to run ${runGenerate}.`);
            process.exit(1);
          }
          console.log(`Generated context data`);
          return;
        }
      } else {
        console.log(`Running ${runGenerate} to generate the context data.`);
        await callPackageManager(packageManager, true, ["run", "generate"]);
        return;
      }
    }

    const settingsMessage = `After setting ${missingSettings.join(" and ")}, run ${runGenerate} to generate the context data.`;
    console.log(`\n${settingsMessage}\n\n`);
  }
}

const copyContextData = async (
  root: string,
  dataSources: TemplateDataSource[],
) => {
  for (const dataSource of dataSources) {
    const dataSourceConfig = dataSource?.config as FileSourceConfig;
    // Copy local data
    const dataPath = dataSourceConfig.path;

    const destPath = path.join(root, "data", path.basename(dataPath));
    console.log("Copying data from path:", dataPath);
    await fsExtra.copy(dataPath, destPath);
  }
};

const installCommunityProject = async ({
  root,
  communityProjectConfig,
}: Pick<InstallTemplateArgs, "root" | "communityProjectConfig">) => {
  const { owner, repo, branch, filePath } = communityProjectConfig!;
  console.log("\nInstalling community project:", filePath || repo);
  await downloadAndExtractRepo(root, {
    username: owner,
    name: repo,
    branch,
    filePath: filePath || "",
  });
};

export const installTemplate = async (
  props: InstallTemplateArgs & { backend: boolean },
) => {
  process.chdir(props.root);

  if (props.template === "community" && props.communityProjectConfig) {
    await installCommunityProject(props);
    return;
  }

  if (props.template === "llamapack" && props.llamapack) {
    await installLlamapackProject(props);
    return;
  }

  if (props.framework === "fastapi") {
    await installPythonTemplate(props);
    if (props.vectorDb !== "llamacloud") {
      // write loaders configuration (currently Python only)
      // not needed for LlamaCloud as it has its own loaders
      await writeLoadersConfig(
        props.root,
        props.dataSources,
        props.useLlamaParse,
      );
    }
  } else {
    await installTSTemplate(props);
  }

  // write tools configuration
  await writeToolsConfig(
    props.root,
    props.tools,
    props.framework === "fastapi" ? ConfigFileType.YAML : ConfigFileType.JSON,
  );

  if (props.backend) {
    // This is a backend, so we need to copy the test data and create the env file.

    // Copy the environment file to the target directory.
    if (
      props.template === "streaming" ||
      props.template === "multiagent" ||
      props.template === "extractor"
    ) {
      await createBackendEnvFile(props.root, props);
    }

    // Always create a data directory
    await makeDir(path.join(props.root, "data"));

    if (props.dataSources.length > 0) {
      console.log("\nGenerating context data...\n");
      await copyContextData(
        props.root,
        props.dataSources.filter((ds) => ds.type === "file"),
      );
      if (
        props.postInstallAction === "runApp" ||
        props.postInstallAction === "dependencies"
      ) {
        await generateContextData(
          props.framework,
          props.modelConfig,
          props.packageManager,
          props.vectorDb,
          props.llamaCloudKey,
          props.useLlamaParse,
        );
      }
    }

    // Create outputs directory
    await makeDir(path.join(props.root, "output/tools"));
    await makeDir(path.join(props.root, "output/uploaded"));
    await makeDir(path.join(props.root, "output/llamacloud"));
  } else {
    // this is a frontend for a full-stack app, create .env file with model information
    await createFrontendEnvFile(props.root, {
      customApiPath: props.customApiPath,
      vectorDb: props.vectorDb,
    });
  }
};

export * from "./types";

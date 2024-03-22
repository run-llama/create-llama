import { copy } from "./copy";
import { callPackageManager } from "./install";

import fs from "fs/promises";
import path from "path";
import { cyan } from "picocolors";

import { templatesDir } from "./dir";
import { createBackendEnvFile, createFrontendEnvFile } from "./env-variables";
import { PackageManager } from "./get-pkg-manager";
import { installLlamapackProject } from "./llama-pack";
import { isHavingPoetryLockFile, tryPoetryRun } from "./poetry";
import { installPythonTemplate } from "./python";
import { downloadAndExtractRepo } from "./repo";
import {
  FileSourceConfig,
  InstallTemplateArgs,
  TemplateDataSource,
  TemplateFramework,
  TemplateVectorDB,
} from "./types";
import { installTSTemplate } from "./typescript";

// eslint-disable-next-line max-params
async function generateContextData(
  framework: TemplateFramework,
  packageManager?: PackageManager,
  openAiKey?: string,
  vectorDb?: TemplateVectorDB,
  llamaCloudKey?: string,
  useLlamaParse?: boolean,
) {
  if (packageManager) {
    const runGenerate = `${cyan(
      framework === "fastapi"
        ? "poetry run python app/engine/generate.py"
        : `${packageManager} run generate`,
    )}`;
    const openAiKeyConfigured = openAiKey || process.env["OPENAI_API_KEY"];
    const llamaCloudKeyConfigured = useLlamaParse
      ? llamaCloudKey || process.env["LLAMA_CLOUD_API_KEY"]
      : true;
    const hasVectorDb = vectorDb && vectorDb !== "none";
    if (framework === "fastapi") {
      if (
        openAiKeyConfigured &&
        llamaCloudKeyConfigured &&
        !hasVectorDb &&
        isHavingPoetryLockFile()
      ) {
        console.log(`Running ${runGenerate} to generate the context data.`);
        const result = tryPoetryRun("python app/engine/generate.py");
        if (!result) {
          console.log(`Failed to run ${runGenerate}.`);
          process.exit(1);
        }
        console.log(`Generated context data`);
        return;
      }
    } else {
      if (openAiKeyConfigured && vectorDb === "none") {
        console.log(`Running ${runGenerate} to generate the context data.`);
        await callPackageManager(packageManager, true, ["run", "generate"]);
        return;
      }
    }

    const settings = [];
    if (!openAiKeyConfigured) settings.push("your OpenAI key");
    if (!llamaCloudKeyConfigured) settings.push("your Llama Cloud key");
    if (hasVectorDb) settings.push("your Vector DB environment variables");
    const settingsMessage =
      settings.length > 0 ? `After setting ${settings.join(" and ")}, ` : "";
    const generateMessage = `run ${runGenerate} to generate the context data.`;
    console.log(`\n${settingsMessage}${generateMessage}\n\n`);
  }
}

const copyContextData = async (
  root: string,
  dataSource?: TemplateDataSource,
) => {
  const destPath = path.join(root, "data");
  const dataSourceConfig = dataSource?.config as FileSourceConfig;

  // Copy file
  if (dataSource?.type === "file") {
    if (dataSourceConfig.paths) {
      await fs.mkdir(destPath, { recursive: true });
      console.log("Copying data from files:", dataSourceConfig.paths.toString());
      for (const p of dataSourceConfig.paths) {
        await fs.copyFile(p, path.join(destPath, path.basename(p)));
      }
    } else {
      console.log("Missing file path in config");
      process.exit(1);
    }
    return;
  }

  // Copy folder
  if (dataSource?.type === "folder") {
    // Example data does not have path config, set the default path
    const srcPaths = dataSourceConfig.paths ?? [
      path.join(templatesDir, "components", "data"),
    ];
    console.log("Copying data from folders: ", srcPaths);
    for (const p of srcPaths) {
      const folderName = path.basename(p);
      const destFolderPath = path.join(destPath, folderName);
      await fs.mkdir(destFolderPath, { recursive: true });
      await copy("**", destFolderPath, {
        parents: true,
        cwd: p,
      });
    }
    return;
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
  } else {
    await installTSTemplate(props);
  }

  if (props.backend) {
    // This is a backend, so we need to copy the test data and create the env file.

    // Copy the environment file to the target directory.
    await createBackendEnvFile(props.root, {
      openAiKey: props.openAiKey,
      llamaCloudKey: props.llamaCloudKey,
      vectorDb: props.vectorDb,
      model: props.model,
      embeddingModel: props.embeddingModel,
      framework: props.framework,
      dataSources: props.dataSources,
      port: props.externalPort,
    });

    if (props.engine === "context") {
      console.log("\nGenerating context data...\n");
      console.log(props.dataSources);

      props.dataSources.forEach(async (ds) => {
        if (ds.type === "file" || ds.type === "folder") {
          await copyContextData(props.root, ds);
        }
      });
      if (
        props.postInstallAction === "runApp" ||
        props.postInstallAction === "dependencies"
      ) {
        await generateContextData(
          props.framework,
          props.packageManager,
          props.openAiKey,
          props.vectorDb,
          props.llamaCloudKey,
          props.dataSources.some(
            (ds) =>
              (ds.type === "file" || ds.type === "folder") &&
              (ds.config as FileSourceConfig).useLlamaParse,
          ),
        );
      }
    }
  } else {
    // this is a frontend for a full-stack app, create .env file with model information
    createFrontendEnvFile(props.root, {
      model: props.model,
      customApiPath: props.customApiPath,
    });
  }
};

export * from "./types";

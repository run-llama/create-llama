import path from "path";
import { green, yellow } from "picocolors";
import { tryGitInit } from "./helpers/git";
import { isFolderEmpty } from "./helpers/is-folder-empty";
import { isWriteable } from "./helpers/is-writeable";
import { makeDir } from "./helpers/make-dir";

import terminalLink from "terminal-link";
import type { InstallTemplateArgs } from "./helpers";
import { installTemplate } from "./helpers";
import { templatesDir } from "./helpers/dir";
import { configVSCode } from "./helpers/vscode";

export type InstallAppArgs = Omit<
  InstallTemplateArgs,
  "appName" | "root" | "port"
> & {
  appPath: string;
};

export async function createApp({
  template,
  framework,
  appPath,
  packageManager,
  modelConfig,
  llamaCloudKey,
  vectorDb,
  postInstallAction,
  dataSources,
  useLlamaParse,
  useCase,
}: InstallAppArgs): Promise<void> {
  const root = path.resolve(appPath);

  if (!(await isWriteable(path.dirname(root)))) {
    console.error(
      "The application path is not writable, please check folder permissions and try again.",
    );
    console.error(
      "It is likely you do not have write permissions for this folder.",
    );
    process.exit(1);
  }

  const appName = path.basename(root);

  await makeDir(root);
  if (!isFolderEmpty(root, appName)) {
    process.exit(1);
  }

  console.log(`Creating a new LlamaIndex app in ${green(root)}.`);
  console.log();

  const args = {
    appName,
    root,
    template,
    framework,
    packageManager,
    modelConfig,
    llamaCloudKey,
    vectorDb,
    postInstallAction,
    dataSources,
    useLlamaParse,
    useCase,
  };

  // Install backend
  await installTemplate(args);

  await configVSCode(root, templatesDir, framework);

  process.chdir(root);
  if (tryGitInit(root)) {
    console.log("Initialized a git repository.");
    console.log();
  }

  console.log("");
  console.log(`${green("Success!")} Created ${appName} at ${appPath}`);

  console.log(
    `Now have a look at the ${terminalLink(
      "README.md",
      `file://${root}/README.md`,
    )} and learn how to get started.`,
  );

  if (
    dataSources.some((dataSource) => dataSource.type === "file") &&
    process.platform === "linux"
  ) {
    console.log(
      yellow(
        `You can add your own data files to ${terminalLink(
          "data",
          `file://${root}/data`,
        )} folder manually.`,
      ),
    );
  }

  console.log();
}

import path from "path";
import { assetRelocator, copy } from "./copy";
import { templatesDir } from "./dir";
import { installPythonDependencies } from "./python";
import { InstallTemplateArgs } from "./types";

export const copyAgenticRAGTemplate = async ({
  root,
}: Pick<InstallTemplateArgs, "root">) => {
  const templatePath = path.join(
    templatesDir,
    "types",
    "multi-agents",
    "fastapi",
  );
  await copy("**", root, {
    parents: true,
    cwd: templatePath,
    rename: assetRelocator,
  });
};

export const installMultiAgentsProject = async ({
  root,
  postInstallAction,
}: Pick<InstallTemplateArgs, "root" | "postInstallAction">) => {
  console.log("\nCreating Multi-agent project:");
  await copyAgenticRAGTemplate({ root });
  if (postInstallAction === "dependencies") {
    installPythonDependencies({ noRoot: true });
  }
};

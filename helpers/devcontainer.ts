import fs from "fs";
import path from "path";
import { TemplateFramework } from "./types";

function renderDevcontainerContent(
  templatesDir: string,
  framework: TemplateFramework,
) {
  const devcontainerJson: any = JSON.parse(
    fs.readFileSync(path.join(templatesDir, "devcontainer.json"), "utf8"),
  );

  // Modify postCreateCommand
  devcontainerJson.postCreateCommand =
    framework === "fastapi" ? "poetry install" : "npm install";

  // Modify containerEnv
  if (framework === "fastapi") {
    devcontainerJson.containerEnv = {
      ...devcontainerJson.containerEnv,
      PYTHONPATH: "${PYTHONPATH}:${workspaceFolder}",
    };
  }

  return JSON.stringify(devcontainerJson, null, 2);
}

export const writeDevcontainer = async (
  root: string,
  templatesDir: string,
  framework: TemplateFramework,
  frontend: boolean,
) => {
  const devcontainerDir = path.join(root, ".devcontainer");
  if (fs.existsSync(devcontainerDir)) {
    console.log("Template already has a .devcontainer. Using it.");
    return;
  }
  const devcontainerContent = renderDevcontainerContent(
    templatesDir,
    framework,
  );
  fs.mkdirSync(devcontainerDir);
  await fs.promises.writeFile(
    path.join(devcontainerDir, "devcontainer.json"),
    devcontainerContent,
  );
};

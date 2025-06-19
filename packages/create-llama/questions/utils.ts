import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { red } from "picocolors";
import prompts from "prompts";
import { TemplateDataSourceType, TemplatePostInstallAction } from "../helpers";
import { QuestionResults } from "./types";

export const supportedContextFileTypes = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
];

const MACOS_FILE_SELECTION_SCRIPT = `
osascript -l JavaScript -e '
  a = Application.currentApplication();
  a.includeStandardAdditions = true;
  a.chooseFile({ withPrompt: "Please select files to process:", multipleSelectionsAllowed: true }).map(file => file.toString())
'`;

const MACOS_FOLDER_SELECTION_SCRIPT = `
osascript -l JavaScript -e '
  a = Application.currentApplication();
  a.includeStandardAdditions = true;
  a.chooseFolder({ withPrompt: "Please select folders to process:", multipleSelectionsAllowed: true }).map(folder => folder.toString())
'`;

const WINDOWS_FILE_SELECTION_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms
$openFileDialog = New-Object System.Windows.Forms.OpenFileDialog
$openFileDialog.InitialDirectory = [Environment]::GetFolderPath('Desktop')
$openFileDialog.Multiselect = $true
$result = $openFileDialog.ShowDialog()
if ($result -eq 'OK') {
  $openFileDialog.FileNames
}
`;

const WINDOWS_FOLDER_SELECTION_SCRIPT = `
Add-Type -AssemblyName System.windows.forms
$folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
$dialogResult = $folderBrowser.ShowDialog()
if ($dialogResult -eq [System.Windows.Forms.DialogResult]::OK)
{
    $folderBrowser.SelectedPath
}
`;

export const selectLocalContextData = async (type: TemplateDataSourceType) => {
  try {
    let selectedPath: string = "";
    let execScript: string;
    let execOpts: any = {};
    switch (process.platform) {
      case "win32": // Windows
        execScript =
          type === "file"
            ? WINDOWS_FILE_SELECTION_SCRIPT
            : WINDOWS_FOLDER_SELECTION_SCRIPT;
        execOpts = { shell: "powershell.exe" };
        break;
      case "darwin": // MacOS
        execScript =
          type === "file"
            ? MACOS_FILE_SELECTION_SCRIPT
            : MACOS_FOLDER_SELECTION_SCRIPT;
        break;
      default: // Unsupported OS
        console.log(red("Unsupported OS error!"));
        process.exit(1);
    }
    selectedPath = execSync(execScript, execOpts).toString().trim();
    const paths =
      process.platform === "win32"
        ? selectedPath.split("\r\n")
        : selectedPath.split(", ");

    for (const p of paths) {
      if (
        fs.statSync(p).isFile() &&
        !supportedContextFileTypes.includes(path.extname(p))
      ) {
        console.log(
          red(
            `Please select a supported file type: ${supportedContextFileTypes}`,
          ),
        );
        process.exit(1);
      }
    }
    return paths;
  } catch (error) {
    console.log(
      red(
        "Got an error when trying to select local context data! Please try again or select another data source option.",
      ),
    );
    process.exit(1);
  }
};

export const onPromptState = (state: any) => {
  if (state.aborted) {
    // If we don't re-enable the terminal cursor before exiting
    // the program, the cursor will remain hidden
    process.stdout.write("\x1B[?25h");
    process.stdout.write("\n");
    process.exit(1);
  }
};

export const toChoice = (value: string) => {
  return { title: value, value };
};

export const questionHandlers = {
  onCancel: () => {
    console.error("Exiting.");
    process.exit(1);
  },
};

// Ask for next action after installation
export async function askPostInstallAction(
  args: Omit<QuestionResults, "postInstallAction">,
): Promise<TemplatePostInstallAction> {
  const actionChoices = [
    {
      title: "Just generate code (~1 sec)",
      value: "none",
    },
    {
      title: "Start in VSCode (~1 sec)",
      value: "VSCode",
    },
    {
      title: "Generate code and install dependencies (~2 min)",
      value: "dependencies",
    },
  ];

  const modelConfigured = args.modelConfig.isConfigured();
  // If using LlamaParse, require LlamaCloud API key
  const llamaCloudKeyConfigured = args.useLlamaParse
    ? args.llamaCloudKey || process.env["LLAMA_CLOUD_API_KEY"]
    : true;
  const hasVectorDb = args.vectorDb && args.vectorDb !== "none";
  // Can run the app if all tools do not require configuration
  if (!hasVectorDb && modelConfigured && llamaCloudKeyConfigured) {
    actionChoices.push({
      title: "Generate code, install dependencies, and run the app (~2 min)",
      value: "runApp",
    });
  }

  const { action } = await prompts(
    {
      type: "select",
      name: "action",
      message: "How would you like to proceed?",
      choices: actionChoices,
      initial: 1,
    },
    questionHandlers,
  );

  return action;
}

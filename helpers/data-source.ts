import { TemplateDataSource, TemplateFramework } from "./types";

const supportedContextFileTypes = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
];

export const supportedDataSources = [
  {
    name: "No data, just a simple chat",
    value: "none",
  },
  {
    name: "Use an example PDF",
    value: "exampleFile",
  },
  {
    name: "Use a local folder",
    value: "folder",
  },
  {
    name: "Use website content (requires Chrome)",
    value: "web",
  },
];

export const getDataSourceChoices = (
  framework: TemplateFramework,
  selectedDataSource: TemplateDataSource[],
) => {
  const choices = [];
  console.log("selectedDataSource", selectedDataSource);

  if (selectedDataSource === undefined || selectedDataSource.length === 0) {
    choices.push({
      title: "No data, just a simple chat",
      value: "none",
    });
    choices.push({
      title: "Use an example PDF",
      value: "exampleFile",
    });
  }
  if (process.platform === "win32" || process.platform === "darwin") {
    choices.push({
      title: `Use local files (${supportedContextFileTypes.join(", ")})`,
      value: "localFile",
    });
    choices.push({
      title: `Use local folders`,
      value: "localFolder",
    });
  }
  if (framework === "fastapi") {
    choices.push({
      title: "Use website content (requires Chrome)",
      value: "web",
    });
  }
  return choices;
};

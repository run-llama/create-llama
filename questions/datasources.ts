import {
  TemplateDataSource,
  TemplateFramework,
  TemplateType,
} from "../helpers";
import { supportedContextFileTypes } from "./utils";

export const getDataSourceChoices = (
  framework: TemplateFramework,
  selectedDataSource: TemplateDataSource[],
  template?: TemplateType,
) => {
  const choices = [];

  if (selectedDataSource.length > 0) {
    choices.push({
      title: "No",
      value: "no",
    });
  }
  if (selectedDataSource === undefined || selectedDataSource.length === 0) {
    choices.push({
      title: "No datasource",
      value: "none",
    });
    choices.push({
      title:
        process.platform !== "linux"
          ? "Use an example PDF"
          : "Use an example PDF (you can add your own data files later)",
      value: "exampleFile",
    });
  }

  // Linux has many distros so we won't support file/folder picker for now
  if (process.platform !== "linux") {
    choices.push(
      {
        title: `Use local files (${supportedContextFileTypes.join(", ")})`,
        value: "file",
      },
      {
        title:
          process.platform === "win32"
            ? "Use a local folder"
            : "Use local folders",
        value: "folder",
      },
    );
  }

  if (framework === "fastapi" && template !== "extractor") {
    choices.push({
      title: "Use website content (requires Chrome)",
      value: "web",
    });
    choices.push({
      title: "Use data from a database (Mysql, PostgreSQL)",
      value: "db",
    });
  }

  return choices;
};

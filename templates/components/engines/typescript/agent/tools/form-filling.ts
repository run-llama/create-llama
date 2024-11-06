import { JSONSchemaType } from "ajv";
import fs from "fs/promises";
import { BaseTool, Settings, ToolMetadata } from "llamaindex";

type ExtractMissingCellsParameter = {
  filePath: string;
};

export type MissingCell = {
  row_index: number;
  column_index: number;
  question: string;
};

const CSV_EXTRACTION_PROMPT = `You are a data analyst. You are given a table with missing cells.
Your task is to identify the missing cells and the questions needed to fill them.
IMPORTANT: Column indices should be 0-based, where the first data column is index 1 
(index 0 is typically the row names/index column).

# Instructions:
- Understand the entire content of the table and the topics of the table.
- Identify the missing cells and the meaning of the data in the cells.
- For each missing cell, provide the row index and the correct column index (remember: first data column is 1).
- For each missing cell, provide the question needed to fill the cell (it's important to provide the question that is relevant to the topic of the table).
- Since the cell's value should be concise, the question should request a numerical answer or a specific value.
- Finally, only return the answer in JSON format with the following schema:
{
  "missing_cells": [
    {
      "row_index": number,
      "column_index": number,
      "question": string
    }
  ]
}
- If there are no missing cells, return an empty array.

# Example:
# |    | Name | Age | City |
# |----|------|-----|------|
# | 0  | John |     | Paris|
# | 1  | Mary |     |      |
# | 2  |      | 30  |      |
#
# Your thoughts:
# - The table is about people's names, ages, and cities.
# - Row: 1, Column: 1 (Age column), Question: "How old is Mary? Please provide only the numerical answer."
# - Row: 1, Column: 2 (City column), Question: "In which city does Mary live? Please provide only the city name."
# Your answer:
# {
#   "missing_cells": [
#     {
#       "row_index": 1,
#       "column_index": 1,
#       "question": "How old is Mary? Please provide only the numerical answer."
#     },
#     {
#       "row_index": 1,
#       "column_index": 2,
#       "question": "In which city does Mary live? Please provide only the city name."
#     }
#   ]
# }


# Here is your task:

- Table content:
{table_content}

- Your answer:
`;

const DEFAULT_METADATA: ToolMetadata<
  JSONSchemaType<ExtractMissingCellsParameter>
> = {
  name: "extract_missing_cells",
  description:
    "Use this tool to extract missing cells in a CSV file and generate questions to fill them. Pass either the path to the CSV file or the content of the CSV file.",
  parameters: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "The path to the CSV file.",
      },
    },
    required: ["filePath"],
  },
};

export interface ExtractMissingCellsParams {
  metadata?: ToolMetadata<JSONSchemaType<ExtractMissingCellsParameter>>;
}

export class ExtractMissingCellsTool
  implements BaseTool<ExtractMissingCellsParameter>
{
  metadata: ToolMetadata<JSONSchemaType<ExtractMissingCellsParameter>>;
  defaultExtractionPrompt: string;

  constructor(params: ExtractMissingCellsParams) {
    this.metadata = params.metadata ?? DEFAULT_METADATA;
    this.defaultExtractionPrompt = CSV_EXTRACTION_PROMPT;
  }

  async readCsvFile(filePath: string): Promise<string> {
    const fileContent = await fs.readFile(filePath, "utf8");
    return fileContent;
  }

  async call(input: ExtractMissingCellsParameter): Promise<MissingCell[]> {
    const { filePath } = input;
    const tableContent = await this.readCsvFile(filePath);
    const prompt = this.defaultExtractionPrompt.replace(
      "{table_content}",
      tableContent,
    );
    const llm = Settings.llm;
    const response = await llm.complete({
      prompt,
    });
    const rawAnswer = response.text;
    const answer = JSON.parse(rawAnswer) as MissingCell[];

    return answer;
  }
}

// TODO: Add filling CSV tool

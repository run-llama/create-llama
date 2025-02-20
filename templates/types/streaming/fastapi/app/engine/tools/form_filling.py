import logging
import os
import uuid
from textwrap import dedent
from typing import Optional

import pandas as pd
from app.services.file import FileService
from llama_index.core import Settings
from llama_index.core.prompts import PromptTemplate
from llama_index.core.tools import FunctionTool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class MissingCell(BaseModel):
    """
    A missing cell in a table.
    """

    row_index: int = Field(description="The index of the row of the missing cell")
    column_index: int = Field(description="The index of the column of the missing cell")
    question_to_answer: str = Field(
        description="The question to answer to fill the missing cell"
    )


class MissingCells(BaseModel):
    """
    A list of missing cells.
    """

    missing_cells: list[MissingCell] = Field(description="The missing cells")


class CellValue(BaseModel):
    row_index: int = Field(description="The row index of the cell")
    column_index: int = Field(description="The column index of the cell")
    value: str = Field(
        description="The value of the cell. Should be a concise value (numerical value or specific value)"
    )


class FormFillingTool:
    """
    Fill out missing cells in a CSV file using information from the knowledge base.
    """

    save_dir: str = os.path.join("output", "tools")

    # Default prompt for extracting questions
    # Replace the default prompt with a custom prompt by setting the EXTRACT_QUESTIONS_PROMPT environment variable.
    _default_extract_questions_prompt = dedent(
        """
        You are a data analyst. You are given a table with missing cells.
        Your task is to identify the missing cells and the questions needed to fill them.
        IMPORTANT: Column indices should be 0-based, where the first data column is index 1 
        (index 0 is typically the row names/index column).

        # Instructions:
        - Understand the entire content of the table and the topics of the table.
        - Identify the missing cells and the meaning of the data in the cells.
        - For each missing cell, provide the row index and the correct column index (remember: first data column is 1).
        - For each missing cell, provide the question needed to fill the cell (it's important to provide the question that is relevant to the topic of the table).
        - Since the cell's value should be concise, the question should request a numerical answer or a specific value.

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
        

        Please provide your answer in the requested format.
        # Here is your task:

        - Table content:
        {table_content}

        - Your answer:
        """
    )

    def extract_questions(
        self,
        file_path: Optional[str] = None,
        file_content: Optional[str] = None,
    ) -> dict:
        """
        Use this tool to extract missing cells in a CSV file and generate questions to fill them.
        Pass either the path to the CSV file or the content of the CSV file.

        Args:
            file_path (Optional[str]): The local file path to the CSV file to extract missing cells from (Don't pass a sandbox path).
            file_content (Optional[str]): The content of the CSV file to extract missing cells from.

        Returns:
            dict: A dictionary containing the missing cells and their corresponding questions.
        """
        extract_questions_prompt = os.getenv(
            "EXTRACT_QUESTIONS_PROMPT", self._default_extract_questions_prompt
        )
        if file_path is None and file_content is None:
            raise ValueError("Either `file_path` or `file_content` must be provided")

        table_content = None

        if file_path:
            file_name, file_extension = self._get_file_name_and_extension(
                file_path, file_content
            )

            try:
                df = pd.read_csv(file_path)
            except FileNotFoundError as e:
                return {
                    "error": str(e),
                    "message": "Please check and update the file path and ensure it's a local path - not a sandbox path.",
                }

            table_content = df.to_markdown()
            if table_content is None:
                raise ValueError("Could not convert the table to markdown")
        if file_content:
            table_content = file_content

        if table_content is None:
            raise ValueError("Table content not found")

        response: MissingCells = Settings.llm.structured_predict(
            output_cls=MissingCells,
            prompt=PromptTemplate(extract_questions_prompt),
            table_content=table_content,
        )
        return response.model_dump()

    def fill_form(
        self,
        cell_values: list[CellValue],
        file_path: Optional[str] = None,
        file_content: Optional[str] = None,
    ) -> dict:
        """
        Use this tool to fill cell values into a CSV file.
        Requires cell values to be used for filling out, as well as either the path to the CSV file or the content of the CSV file.

        Args:
            cell_values (list[CellValue]): The cell values used to fill out the CSV file (call `extract_questions` and query engine to construct the cell values).
            file_path (Optional[str]): The local file path to the CSV file that should be filled out (not as sandbox path).
            file_content (Optional[str]): The content of the CSV file that should be filled out.

        Returns:
            dict: A dictionary containing the content and metadata of the filled-out file.
        """
        file_name, file_extension = self._get_file_name_and_extension(
            file_path, file_content
        )
        df = pd.read_csv(file_path)

        # Fill the dataframe with the cell values
        filled_df = df.copy()
        for cell_value in cell_values:
            if not isinstance(cell_value, CellValue):
                cell_value = CellValue(**cell_value)
            filled_df.iloc[cell_value.row_index, cell_value.column_index] = (
                cell_value.value
            )

        # Save the filled table to a new CSV file
        csv_content: str = filled_df.to_csv(index=False)
        file_metadata = FileService.save_file(
            content=csv_content,
            file_name=f"{file_name}_filled.csv",
            save_dir=self.save_dir,
        )

        new_content: str = filled_df.to_markdown()
        result = {
            "filled_content": new_content,
            "filled_file": file_metadata,
        }
        return result

    def _get_file_name_and_extension(
        self, file_path: Optional[str], file_content: Optional[str]
    ) -> tuple[str, str]:
        if file_path is None and file_content is None:
            raise ValueError("Either `file_path` or `file_content` must be provided")

        if file_path is None:
            file_name = str(uuid.uuid4())
            file_extension = ".csv"
        else:
            file_name, file_extension = os.path.splitext(file_path)
            if file_extension != ".csv":
                raise ValueError("Form filling is only supported for CSV files")

        return file_name, file_extension

    def _save_output(self, file_name: str, output: str) -> dict:
        """
        Save the output to a file.
        """
        file_metadata = FileService.save_file(
            content=output,
            file_name=file_name,
            save_dir=self.save_dir,
        )
        return file_metadata.model_dump()


def get_tools(**kwargs):
    tool = FormFillingTool()
    return [
        FunctionTool.from_defaults(tool.extract_questions),
        FunctionTool.from_defaults(tool.fill_form),
    ]

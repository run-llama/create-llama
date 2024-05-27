import os
import logging
import base64
import uuid
from pydantic import BaseModel
from typing import List, Tuple, Dict
from llama_index.core.tools import FunctionTool
from e2b_code_interpreter import CodeInterpreter
from e2b_code_interpreter.models import Logs


logger = logging.getLogger(__name__)


class InterpreterExtraResult(BaseModel):
    type: str
    filename: str
    url: str


class E2BToolOutput(BaseModel):
    is_error: bool
    logs: Logs
    results: List[InterpreterExtraResult] = []


class E2BCodeInterpreter:

    output_dir = "tool-output"

    def __init__(self, api_key: str, filesever_url_prefix: str):
        self.api_key = api_key
        self.filesever_url_prefix = filesever_url_prefix

    def get_output_path(self, filename: str) -> str:
        # if output directory doesn't exist, create it
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir, exist_ok=True)
        return os.path.join(self.output_dir, filename)

    def save_to_disk(self, base64_data: str, ext: str) -> Dict:
        filename = f"{uuid.uuid4()}.{ext}"  # generate a unique filename
        buffer = base64.b64decode(base64_data)
        output_path = self.get_output_path(filename)

        try:
            with open(output_path, "wb") as file:
                file.write(buffer)
        except IOError as e:
            logger.error(f"Failed to write to file {output_path}: {str(e)}")
            raise e

        logger.info(f"Saved file to {output_path}")

        return {
            "outputPath": output_path,
            "filename": filename,
        }

    def get_file_url(self, filename: str) -> str:
        return f"{self.filesever_url_prefix}/{self.output_dir}/{filename}"

    def parse_result(self, result) -> List[InterpreterExtraResult]:
        """
        The result could include multiple formats (e.g. png, svg, etc.) but encoded in base64
        We save each result to disk and return saved file metadata (extension, filename, url)
        """
        if not result:
            return []

        output = []

        try:
            formats = result.formats()
            base64_data_arr = [result[format] for format in formats]

            for ext, base64_data in zip(formats, base64_data_arr):
                if ext and base64_data:
                    result = self.save_to_disk(base64_data, ext)
                    filename = result["filename"]
                    output.append(
                        InterpreterExtraResult(
                            type=ext, filename=filename, url=self.get_file_url(filename)
                        )
                    )
        except Exception as error:
            logger.error("Error when saving data to disk", error)

        return output

    def interpret(self, code: str) -> E2BToolOutput:
        with CodeInterpreter(api_key=self.api_key) as interpreter:
            logger.info(
                f"\n{'='*50}\n> Running following AI-generated code:\n{code}\n{'='*50}"
            )
            exec = interpreter.notebook.exec_cell(code)

            if exec.error:
                output = E2BToolOutput(is_error=True, logs=[exec.error])
            else:
                if len(exec.results) == 0:
                    output = E2BToolOutput(is_error=False, logs=exec.logs, results=[])
                else:
                    results = self.parse_result(exec.results[0])
                    output = E2BToolOutput(
                        is_error=False, logs=exec.logs, results=results
                    )
            return output


def code_interpret(code: str) -> Dict:
    """
    Execute python code in a Jupyter notebook cell and return any result, stdout, stderr, display_data, and error.
    """
    api_key = os.getenv("E2B_API_KEY")
    filesever_url_prefix = os.getenv("FILESERVER_URL_PREFIX")
    if not api_key:
        raise ValueError(
            "E2B_API_KEY key is required to run code interpreter. Get it here: https://e2b.dev/docs/getting-started/api-key"
        )
    if not filesever_url_prefix:
        raise ValueError(
            "FILESERVER_URL_PREFIX is required to display file output from sandbox"
        )

    interpreter = E2BCodeInterpreter(
        api_key=api_key, filesever_url_prefix=filesever_url_prefix
    )
    output = interpreter.interpret(code)
    return output.dict()


# Specify as functions tools to be loaded by the ToolFactory
tools = [FunctionTool.from_defaults(code_interpret)]

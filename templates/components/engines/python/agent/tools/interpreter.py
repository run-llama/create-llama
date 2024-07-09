import os
import logging
import base64
import uuid
from pydantic import BaseModel
from typing import List, Tuple, Dict, Optional
from llama_index.core.tools import FunctionTool
from e2b_code_interpreter import CodeInterpreter
from e2b_code_interpreter.models import Logs


logger = logging.getLogger(__name__)


class InterpreterExtraResult(BaseModel):
    type: str
    content: Optional[str] = None
    filename: Optional[str] = None
    url: Optional[str] = None


class E2BToolOutput(BaseModel):
    is_error: bool
    logs: Logs
    results: List[InterpreterExtraResult] = []


class E2BCodeInterpreter:

    output_dir = "output/tool"

    def __init__(self, api_key: str = None):
        if api_key is None:
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

        self.filesever_url_prefix = filesever_url_prefix
        self.interpreter = CodeInterpreter(api_key=api_key)

    def __del__(self):
        self.interpreter.close()

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
            results = [result[format] for format in formats]

            for ext, data in zip(formats, results):
                match ext:
                    case "png" | "svg" | "jpeg" | "pdf":
                        result = self.save_to_disk(data, ext)
                        filename = result["filename"]
                        output.append(
                            InterpreterExtraResult(
                                type=ext,
                                filename=filename,
                                url=self.get_file_url(filename),
                            )
                        )
                    case _:
                        output.append(
                            InterpreterExtraResult(
                                type=ext,
                                content=data,
                            )
                        )
        except Exception as error:
            logger.exception(error, exc_info=True)
            logger.error("Error when parsing output from E2b interpreter tool", error)

        return output

    def interpret(self, code: str) -> E2BToolOutput:
        """
        Execute python code in a Jupyter notebook cell, the toll will return result, stdout, stderr, display_data, and error.

        Parameters:
            code (str): The python code to be executed in a single cell.
        """
        logger.info(
            f"\n{'='*50}\n> Running following AI-generated code:\n{code}\n{'='*50}"
        )
        exec = self.interpreter.notebook.exec_cell(code)

        if exec.error:
            logger.error("Error when executing code", exec.error)
            output = E2BToolOutput(is_error=True, logs=exec.logs, results=[])
        else:
            if len(exec.results) == 0:
                output = E2BToolOutput(is_error=False, logs=exec.logs, results=[])
            else:
                results = self.parse_result(exec.results[0])
                output = E2BToolOutput(is_error=False, logs=exec.logs, results=results)
        return output


def get_tools(**kwargs):
    return [FunctionTool.from_defaults(E2BCodeInterpreter(**kwargs).interpret)]

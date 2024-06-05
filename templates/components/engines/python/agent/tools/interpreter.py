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
    results: List[InterpreterExtraResult | str] = []


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
        The result format could be either a base64 string (png, svg, etc.) or a raw text (text, html, markdown,...)
        If it's base64, we save each result to disk and return saved file metadata (extension, filename, url),
        otherwise just return the raw text content
        """
        if not result:
            return []

        output = []

        try:
            formats = result.formats()
            data_list = [result[format] for format in formats]

            for ext, data in zip(formats, data_list):
                match ext:
                    case "png" | "jpeg" | "svg":
                        result = self.save_to_disk(data, ext)
                        filename = result["filename"]
                        output.append(
                            InterpreterExtraResult(
                                type=ext,
                                filename=filename,
                                url=self.get_file_url(filename),
                            )
                        )
                        break
                    case "text" | "html" | "markdown":
                        output.append(InterpreterExtraResult(type=ext, content=data))
        except Exception as error:
            logger.error("Error when saving data to disk", error)

        return output

    def interpret(self, code: str, file_path: Optional[str] = None) -> E2BToolOutput:
        with CodeInterpreter(api_key=self.api_key) as interpreter:
            # Upload file to E2B sandbox
            if file_path is not None:
                with open(file_path, "rb") as f:
                    remote_path = interpreter.upload_file(f)

            # Execute the code to analyze the file
            logger.info(
                f"\n{'='*50}\n> Running following AI-generated code:\n{code}\n{'='*50}"
            )
            exec = interpreter.notebook.exec_cell(code)

            if exec.error:
                logger.error(
                    f"Error when executing code in E2B sandbox: {exec.error} {exec.logs}"
                )
                output = E2BToolOutput(is_error=True, logs=exec.logs, results=[])
            else:
                if len(exec.results) == 0:
                    output = E2BToolOutput(is_error=False, logs=exec.logs, results=[])
                else:
                    results = self.parse_result(exec.results[0])
                    output = E2BToolOutput(
                        is_error=False, logs=exec.logs, results=results
                    )
            return output


def code_interpret(code: str, local_file_path: str) -> Dict:
    """
    Use this tool to analyze the provided data in a sandbox environment.
    The tool will:
        1. Upload the provided file from local to the sandbox. The uploaded file path will be /home/user/{filename}
        2. Execute python code in a Jupyter notebook cell to analyze the uploaded file in the sandbox.
        3. Get the result from the code in stdout, stderr, display_data, and error.
    You must to provide the code and the provided file path to run this tool.
    Your code should read the file from the sandbox path /home/user/{filename}.
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
    output = interpreter.interpret(code, local_file_path)
    return output.dict()


# Specify as functions tools to be loaded by the ToolFactory
tools = [FunctionTool.from_defaults(code_interpret)]

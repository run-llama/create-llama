import base64
import logging
import os
import uuid
from typing import List, Optional

from app.engine.utils.file_helper import FileMetadata, save_file
from e2b_code_interpreter import CodeInterpreter
from e2b_code_interpreter.models import Logs
from llama_index.core.tools import FunctionTool
from pydantic import BaseModel

logger = logging.getLogger("uvicorn")


class InterpreterExtraResult(BaseModel):
    type: str
    content: Optional[str] = None
    filename: Optional[str] = None
    url: Optional[str] = None


class E2BToolOutput(BaseModel):
    is_error: bool
    logs: Logs
    error_message: Optional[str] = None
    results: List[InterpreterExtraResult] = []
    retry_count: int = 0


class E2BCodeInterpreter:
    output_dir = "output/tools"
    uploaded_files_dir = "output/uploaded"

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
        self.interpreter = None
        self.api_key = api_key

    def __del__(self):
        """
        Kill the interpreter when the tool is no longer in use
        """
        if self.interpreter is not None:
            self.interpreter.kill()

    def _init_interpreter(self, sandbox_files: List[str] = []):
        """
        Lazily initialize the interpreter.
        """
        logger.info(f"Initializing interpreter with {len(sandbox_files)} files")
        self.interpreter = CodeInterpreter(api_key=self.api_key)
        if len(sandbox_files) > 0:
            for file_path in sandbox_files:
                file_name = os.path.basename(file_path)
                local_file_path = os.path.join(self.uploaded_files_dir, file_name)
                with open(local_file_path, "rb") as f:
                    content = f.read()
                    if self.interpreter and self.interpreter.files:
                        self.interpreter.files.write(file_path, content)
            logger.info(f"Uploaded {len(sandbox_files)} files to sandbox")

    def _save_to_disk(self, base64_data: str, ext: str) -> FileMetadata:
        buffer = base64.b64decode(base64_data)

        filename = f"{uuid.uuid4()}.{ext}"  # generate a unique filename
        output_path = os.path.join(self.output_dir, filename)

        file_metadata = save_file(buffer, file_path=output_path)

        return file_metadata

    def _parse_result(self, result) -> List[InterpreterExtraResult]:
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
                        file_metadata = self._save_to_disk(data, ext)
                        output.append(
                            InterpreterExtraResult(
                                type=ext,
                                filename=file_metadata.name,
                                url=file_metadata.url,
                            )
                        )
                    case _:
                        # Try serialize data to string
                        try:
                            data = str(data)
                        except Exception as e:
                            data = f"Error when serializing data: {e}"
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

    def interpret(
        self,
        code: str,
        sandbox_files: List[str] = [],
        retry_count: int = 0,
    ) -> E2BToolOutput:
        """
        Execute Python code in a Jupyter notebook cell. The tool will return the result, stdout, stderr, display_data, and error.
        If the code needs to use a file, ALWAYS pass the file path in the sandbox_files argument.
        You have a maximum of 3 retries to get the code to run successfully.

        Parameters:
            code (str): The Python code to be executed in a single cell.
            sandbox_files (List[str]): List of local file paths to be used by the code. The tool will throw an error if a file is not found.
            retry_count (int): Number of times the tool has been retried.
        """
        if retry_count > 2:
            return E2BToolOutput(
                is_error=True,
                logs=Logs(
                    stdout="",
                    stderr="",
                    display_data="",
                    error="",
                ),
                error_message="Failed to execute the code after 3 retries. Explain the error to the user and suggest a fix.",
                retry_count=retry_count,
            )

        if self.interpreter is None:
            self._init_interpreter(sandbox_files)

        if self.interpreter and self.interpreter.notebook:
            logger.info(
                f"\n{'='*50}\n> Running following AI-generated code:\n{code}\n{'='*50}"
            )
            exec = self.interpreter.notebook.exec_cell(code)

            if exec.error:
                error_message = f"The code failed to execute successfully. Error: {exec.error}. Try to fix the code and run again."
                logger.error(error_message)
                # Calling the generated code caused an error. Kill the interpreter and return the error to the LLM so it can try to fix the error
                try:
                    self.interpreter.kill()  # type: ignore
                except Exception:
                    pass
                finally:
                    self.interpreter = None
                output = E2BToolOutput(
                    is_error=True,
                    logs=exec.logs,
                    results=[],
                    error_message=error_message,
                    retry_count=retry_count + 1,
                )
            else:
                if len(exec.results) == 0:
                    output = E2BToolOutput(is_error=False, logs=exec.logs, results=[])
                else:
                    results = self._parse_result(exec.results[0])
                    output = E2BToolOutput(
                        is_error=False,
                        logs=exec.logs,
                        results=results,
                        retry_count=retry_count + 1,
                    )
            return output
        else:
            raise ValueError("Interpreter is not initialized.")


def get_tools(**kwargs):
    return [FunctionTool.from_defaults(E2BCodeInterpreter(**kwargs).interpret)]

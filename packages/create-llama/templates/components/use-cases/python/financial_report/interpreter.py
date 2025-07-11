import base64
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Any, List, Optional

from pydantic import BaseModel

from llama_index.core.tools import FunctionTool

logger = logging.getLogger("uvicorn")


class FileMetadata(BaseModel):
    """Simple file metadata model"""

    id: str
    type: str
    size: int
    url: str
    path: str


class InterpreterExtraResult(BaseModel):
    type: str
    content: Optional[str] = None
    filename: Optional[str] = None
    url: Optional[str] = None


class E2BToolOutput(BaseModel):
    is_error: bool
    logs: "Logs"  # type: ignore # noqa: F821
    error_message: Optional[str] = None
    results: List[InterpreterExtraResult] = []
    retry_count: int = 0


class E2BCodeInterpreter:
    output_dir = "output/tools"
    uploaded_files_dir = "output/uploaded"
    interpreter: Optional["Sandbox"] = None  # type: ignore # noqa: F821

    def __init__(
        self,
        api_key: str,
        output_dir: Optional[str] = None,
        uploaded_files_dir: Optional[str] = None,
    ):
        """
        Args:
            api_key: The API key for the E2B Code Interpreter.
            output_dir: The directory for the output files. Default is `output/tools`.
            uploaded_files_dir: The directory for the files to be uploaded to the sandbox. Default is `output/uploaded`.
        """
        self._validate_package()
        if not api_key:
            raise ValueError(
                "api_key is required to run code interpreter. Get it here: https://e2b.dev/docs/getting-started/api-key"
            )
        self.api_key = api_key
        self.output_dir = output_dir or "output/tools"
        self.uploaded_files_dir = uploaded_files_dir or "output/uploaded"

    @classmethod
    def _validate_package(cls) -> None:
        try:
            from e2b_code_interpreter import Sandbox  # noqa: F401
            from e2b_code_interpreter.models import Logs  # noqa: F401
        except ImportError:
            raise ImportError(
                "e2b_code_interpreter is not installed. Please install it using `pip install e2b-code-interpreter`."
            )

    def __del__(self) -> None:
        """
        Kill the interpreter when the tool is no longer in use.
        """
        if self.interpreter is not None:
            self.interpreter.kill()

    def _init_interpreter(self, sandbox_files: List[str] = []) -> None:
        """
        Lazily initialize the interpreter.
        """
        from e2b_code_interpreter import Sandbox

        logger.info(f"Initializing interpreter with {len(sandbox_files)} files")
        self.interpreter = Sandbox(api_key=self.api_key)
        if len(sandbox_files) > 0:
            for file_path in sandbox_files:
                file_name = os.path.basename(file_path)
                local_file_path = os.path.join(self.uploaded_files_dir, file_name)
                with open(local_file_path, "rb") as f:
                    content = f.read()
                    if self.interpreter and self.interpreter.files:
                        self.interpreter.files.write(file_path, content)
            logger.info(f"Uploaded {len(sandbox_files)} files to sandbox")

    def _process_file_name(self, file_name: str) -> tuple[str, str]:
        """
        Process original file name to generate a unique file id and extension.
        """
        _id = str(uuid.uuid4())
        name, extension = os.path.splitext(file_name)
        extension = extension.lstrip(".")
        if extension == "":
            raise ValueError("File name is not valid! It must have an extension.")
        # sanitize the name
        name = re.sub(r"[^a-zA-Z0-9.]", "_", name)
        file_id = f"{name}_{_id}.{extension}"
        return file_id, extension

    def _get_file_url(self, file_id: str, save_dir: str) -> str:
        """
        Get the URL of a file.
        """
        # Ensure the path uses forward slashes for URLs
        url_path = f"{save_dir}/{file_id}".replace("\\", "/")
        return f"/api/files/{url_path}"

    def _save_file(self, content: bytes, file_name: str, save_dir: str) -> FileMetadata:
        file_id, extension = self._process_file_name(file_name)
        file_path = os.path.join(save_dir, file_id)

        # Write the file directly
        try:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "wb") as f:
                f.write(content)
        except PermissionError as e:
            logger.error(f"Permission denied when writing to file {file_path}: {e!s}")
            raise
        except OSError as e:
            logger.error(f"IO error occurred when writing to file {file_path}: {e!s}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error when writing to file {file_path}: {e!s}")
            raise

        logger.info(f"Saved file to {file_path}")

        file_size = os.path.getsize(file_path)
        file_url = self._get_file_url(file_id, save_dir)

        return FileMetadata(
            id=file_id,
            type=extension,
            size=file_size,
            url=file_url,
            path=file_path,
        )

    def _save_to_disk(self, base64_data: str, ext: str) -> FileMetadata:
        buffer = base64.b64decode(base64_data)

        # Output from e2b doesn't have a name. Create a random name for it.
        filename = f"e2b_file_{uuid.uuid4()}.{ext}"

        return self._save_file(buffer, file_name=filename, save_dir=self.output_dir)

    def _parse_result(self, result: Any) -> List[InterpreterExtraResult]:
        """
        The result could include multiple formats (e.g. png, svg, etc.) but encoded in base64
        We save each result to disk and return saved file metadata (extension, filename, url).
        """
        if not result:
            return []

        output = []

        try:
            formats = result.formats()
            results = [result[format] for format in formats]

            for ext, data in zip(formats, results):
                if ext in ["png", "svg", "jpeg", "pdf"]:
                    document_file = self._save_to_disk(data, ext)
                    output.append(
                        InterpreterExtraResult(
                            type=ext,
                            filename=document_file.id,
                            url=document_file.url,
                        )
                    )
                else:
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
        from e2b_code_interpreter.models import Logs

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

        if self.interpreter:
            logger.info(
                f"\n{'=' * 50}\n> Running following AI-generated code:\n{code}\n{'=' * 50}"
            )
            exec = self.interpreter.run_code(code)

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

    def to_tool(self) -> FunctionTool:
        self._validate_package()
        return FunctionTool.from_defaults(self.interpret)

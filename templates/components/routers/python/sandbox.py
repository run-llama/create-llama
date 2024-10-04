import base64
import logging
import os
import uuid
from typing import Dict, List, Optional, Union

from app.engine.tools.artifact import CodeArtifact
from app.engine.utils.file_helper import save_file
from e2b_code_interpreter import CodeInterpreter, Sandbox
from fastapi import APIRouter, Request
from pydantic import BaseModel

logger = logging.getLogger("uvicorn")

sandbox_router = APIRouter()

SANDBOX_TIMEOUT = 10 * 60  # timeout in seconds
MAX_DURATION = 60  # max duration in seconds


class ExecutionResult(BaseModel):
    template: str
    stdout: List[str]
    stderr: List[str]
    runtime_error: Optional[Dict[str, Union[str, List[str]]]] = None
    output_urls: List[Dict[str, str]]
    url: Optional[str]

    def to_response(self):
        """
        Convert the execution result to a response object (camelCase)
        """
        return {
            "template": self.template,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "runtimeError": self.runtime_error,
            "outputUrls": self.output_urls,
            "url": self.url,
        }


@sandbox_router.post("")
async def create_sandbox(request: Request):
    request_data = await request.json()

    artifact = CodeArtifact(**request_data["artifact"])

    sbx = None

    # Create an interpreter or a sandbox
    if artifact.template == "code-interpreter-multilang":
        sbx = CodeInterpreter(api_key=os.getenv("E2B_API_KEY"), timeout=SANDBOX_TIMEOUT)
        logger.debug(f"Created code interpreter {sbx}")
    else:
        sbx = Sandbox(
            api_key=os.getenv("E2B_API_KEY"),
            template=artifact.template,
            metadata={"template": artifact.template, "user_id": "default"},
            timeout=SANDBOX_TIMEOUT,
        )
        logger.debug(f"Created sandbox {sbx}")

    # Install packages
    if artifact.has_additional_dependencies:
        if isinstance(sbx, CodeInterpreter):
            sbx.notebook.exec_cell(artifact.install_dependencies_command)
            logger.debug(
                f"Installed dependencies: {', '.join(artifact.additional_dependencies)} in code interpreter {sbx}"
            )
        elif isinstance(sbx, Sandbox):
            sbx.commands.run(artifact.install_dependencies_command)
            logger.debug(
                f"Installed dependencies: {', '.join(artifact.additional_dependencies)} in sandbox {sbx}"
            )

    # Copy code to disk
    if isinstance(artifact.code, list):
        for file in artifact.code:
            sbx.files.write(file.file_path, file.file_content)
            logger.debug(f"Copied file to {file.file_path}")
    else:
        sbx.files.write(artifact.file_path, artifact.code)
        logger.debug(f"Copied file to {artifact.file_path}")

    # Execute code or return a URL to the running sandbox
    if artifact.template == "code-interpreter-multilang":
        result = sbx.notebook.exec_cell(artifact.code or "")
        output_urls = _download_cell_results(result.results)
        return ExecutionResult(
            template=artifact.template,
            stdout=result.logs.stdout,
            stderr=result.logs.stderr,
            runtime_error=result.error,
            output_urls=output_urls,
            url=None,
        ).to_response()
    else:
        return ExecutionResult(
            template=artifact.template,
            stdout=[],
            stderr=[],
            runtime_error=None,
            output_urls=[],
            url=f"https://{sbx.get_host(artifact.port or 80)}",
        ).to_response()


def _download_cell_results(cell_results: Optional[List]) -> List[Dict[str, str]]:
    """
    To pull results from code interpreter cell and save them to disk for serving
    """
    if not cell_results:
        return []

    output = []
    for result in cell_results:
        try:
            formats = result.formats()
            for ext in formats:
                data = result[ext]

                if ext in ["png", "svg", "jpeg", "pdf"]:
                    file_path = f"output/tools/{uuid.uuid4()}.{ext}"
                    base64_data = data
                    buffer = base64.b64decode(base64_data)
                    file_meta = save_file(content=buffer, file_path=file_path)
                    output.append(
                        {
                            "type": ext,
                            "filename": file_meta.filename,
                            "url": file_meta.url,
                        }
                    )
        except Exception as e:
            logger.error(f"Error processing result: {str(e)}")

    return output

# Copyright 2024 FoundryLabs, Inc. and LlamaIndex, Inc.
# Portions of this file are copied from the e2b project (https://github.com/e2b-dev/ai-artifacts) and then converted to Python
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import base64
import logging
import os
import uuid
from dataclasses import asdict
from typing import Any, Dict, List, Optional, Union

from app.engine.tools.artifact import CodeArtifact
from app.services.file import FileService
from e2b_code_interpreter import CodeInterpreter, Sandbox  # type: ignore
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

logger = logging.getLogger("uvicorn")

sandbox_router = APIRouter()

SANDBOX_TIMEOUT = 10 * 60  # timeout in seconds
MAX_DURATION = 60  # max duration in seconds


class ExecutionResult(BaseModel):
    template: str
    stdout: List[str]
    stderr: List[str]
    runtime_error: Optional[Dict[str, Any]] = None
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


class FileUpload(BaseModel):
    id: str
    name: str


@sandbox_router.post("")
async def create_sandbox(request: Request):
    request_data = await request.json()
    artifact_data = request_data.get("artifact", None)
    sandbox_files = artifact_data.get("files", [])

    if not artifact_data:
        raise HTTPException(
            status_code=400, detail="Could not create artifact from the request data"
        )

    try:
        artifact = CodeArtifact(**artifact_data)
    except Exception:
        logger.error(f"Could not create artifact from request data: {request_data}")
        raise HTTPException(
            status_code=400, detail="Could not create artifact from the request data"
        )

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

    # Copy files
    if len(sandbox_files) > 0:
        _upload_files(sbx, sandbox_files)

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
        runtime_error = asdict(result.error) if result.error else None
        return ExecutionResult(
            template=artifact.template,
            stdout=result.logs.stdout,
            stderr=result.logs.stderr,
            runtime_error=runtime_error,
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


def _upload_files(
    sandbox: Union[CodeInterpreter, Sandbox],
    sandbox_files: List[str] = [],
) -> None:
    for file_path in sandbox_files:
        file_name = os.path.basename(file_path)
        local_file_path = os.path.join("output", "uploaded", file_name)
        with open(local_file_path, "rb") as f:
            content = f.read()
            sandbox.files.write(file_path, content)
    return None


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
                    base64_data = data
                    buffer = base64.b64decode(base64_data)
                    file_name = f"{uuid.uuid4()}.{ext}"
                    file_meta = FileService.save_file(
                        content=buffer,
                        file_name=file_name,
                        save_dir=os.path.join("output", "tools"),
                    )
                    output.append(
                        {
                            "type": ext,
                            "filename": file_meta.name,
                            "url": file_meta.url,
                        }
                    )
        except Exception as e:
            logger.error(f"Error processing result: {str(e)}")

    return output

import os
import tempfile

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from llama_index.server.settings import server_settings
from llama_index.server.utils.workflow_validation import validate_workflow_file


class WorkflowFile(BaseModel):
    last_modified: int
    file_path: str = Field(
        default="app/workflow.py",
        description="Relative path to the workflow file",
    )
    content: str


class WorkflowFileUpdate(BaseModel):
    content: str
    file_path: str = Field(
        default="app/workflow.py",
        description="Relative path to the workflow file",
    )


class WorkflowValidationResult(BaseModel):
    valid: bool
    error: str


def dev_router() -> APIRouter:
    # Use a prefix here to avoid conflicts with other routers
    # but we probably don't need to do this
    router = APIRouter(prefix="/dev", tags=["dev"])

    default_workflow_file_path = "app/workflow.py"

    @router.get("/files/workflow")
    async def get_workflow_file() -> WorkflowFile:
        """
        Fetch the current workflow code
        """
        # Check if the file exists
        if not os.path.exists(default_workflow_file_path):
            raise HTTPException(
                status_code=400,
                detail="Dev mode is currently in beta. It only supports updating workflow file at 'app/workflow.py'",
            )
        stat = os.stat(default_workflow_file_path)
        with open(default_workflow_file_path, "r") as f:
            return WorkflowFile(
                last_modified=int(stat.st_mtime),
                file_path=default_workflow_file_path,
                content=f.read(),
            )

    @router.post("/files/workflow/validate")
    async def validate_workflow(file: WorkflowFileUpdate) -> WorkflowValidationResult:
        """
        Validate the current workflow code
        """
        try:
            if file.file_path != default_workflow_file_path:
                raise HTTPException(
                    status_code=400, detail=f"Updating {file.file_path} is not allowed"
                )
            validate_workflow_file(
                workflow_content=file.content,
                factory_signature=server_settings.workflow_factory_signature,
            )
            return WorkflowValidationResult(valid=True, error="")
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    @router.put("/files/workflow")
    async def put_workflow_file(update: WorkflowFileUpdate) -> None:
        """
        Update the current workflow code
        """
        # Validations
        if update.file_path != default_workflow_file_path:
            raise HTTPException(
                status_code=400, detail=f"Updating {update.file_path} is not allowed"
            )
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as tmp:
            tmp.write(update.content)
            tmp_path = tmp.name
        try:
            # Validate workflow file using the actual callable name from the workflow_factory
            factory_func_name = server_settings.workflow_factory_signature
            validate_workflow_file(
                workflow_path=tmp_path, factory_signature=factory_func_name
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        # If all checks pass, overwrite the real file
        with open(default_workflow_file_path, "w") as f:
            f.write(update.content)

    return router

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import tempfile
from llama_index.server.utils.workflow_validation import validate_workflow_file
from llama_index.server.settings import server_settings


class WorkflowFile(BaseModel):
    last_modified: int
    file_name: str
    content: str


class WorkflowFileUpdate(BaseModel):
    content: str
    file_name: str


class WorkflowValidationResult(BaseModel):
    valid: bool
    error: str


def dev_router() -> APIRouter:
    # Use a prefix here to avoid conflicts with other routers
    # but we probably don't need to do this
    router = APIRouter(prefix="/dev", tags=["dev"])

    default_workflow_file_path = "workflow.py"
    default_workflow_file_name = os.path.basename(default_workflow_file_path)

    @router.get("/files/workflow")
    async def get_workflow_file() -> WorkflowFile:
        """
        Fetch the current workflow code
        """
        stat = os.stat(default_workflow_file_path)
        with open(default_workflow_file_path, "r") as f:
            return WorkflowFile(
                last_modified=int(stat.st_mtime),
                file_name=default_workflow_file_name,
                content=f.read(),
            )

    @router.post("/files/workflow/validate")
    async def validate_workflow(file: WorkflowFileUpdate) -> WorkflowValidationResult:
        """
        Validate the current workflow code
        """
        try:
            if file.file_name != default_workflow_file_name:
                raise HTTPException(
                    status_code=400, detail=f"Updating {file.file_name} is not allowed"
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
        if update.file_name != default_workflow_file_name:
            raise HTTPException(
                status_code=400, detail=f"Updating {update.file_name} is not allowed"
            )
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as tmp:
            tmp.write(update.content)
            tmp_path = tmp.name
        try:
            # Validate workflow file using the actual callable name from the workflow_factory
            factory_func_name = server_settings.workflow_factory_signature
            print(f"Validating workflow file: {tmp_path}")
            print(f"Factory function name: {factory_func_name}")
            validate_workflow_file(
                workflow_path=tmp_path, factory_signature=factory_func_name
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        # If all checks pass, overwrite the real file
        with open(default_workflow_file_path, "w") as f:
            f.write(update.content)

    return router

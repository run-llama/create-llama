import json
from pathlib import Path

from llama_index.core.workflow import Context, JsonSerializer, Workflow


class WorkflowService:
    @staticmethod
    def get_storage_path(chat_id: str) -> Path:
        storage_dir = Path("output") / "checkpoints"
        if not storage_dir.exists():
            storage_dir.mkdir(parents=True, exist_ok=True)
        return storage_dir / f"{chat_id}.json"

    @classmethod
    def save_context(
        cls,
        chat_id: str,
        ctx: Context,
    ) -> str:
        """Save the current checkpoint to a file and return the chat_id"""
        ctx_data = ctx.to_dict(serializer=JsonSerializer())
        with open(cls.get_storage_path(chat_id), "w") as f:
            json.dump(ctx_data, f)
        return chat_id

    @classmethod
    def load_context(
        cls,
        chat_id: str,
        workflow: Workflow,
    ) -> Context:
        with open(cls.get_storage_path(chat_id), "r") as f:
            ctx_data = json.load(f)
        ctx = Context.from_dict(
            workflow=workflow,
            data=ctx_data,
            serializer=JsonSerializer(),
        )
        return ctx

    @classmethod
    def clear_context(cls, chat_id: str) -> None:
        if cls.get_storage_path(chat_id).exists():
            cls.get_storage_path(chat_id).unlink()

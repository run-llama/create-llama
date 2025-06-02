import json
import logging
from pathlib import Path
from typing import Type

from llama_index.core.workflow import (
    Context,
    JsonSerializer,
    Workflow,
)
from llama_index.server.models.hitl import HumanResponseEvent
from llama_index.server.utils.class_meta_serialization import (
    type_from_identifier,
    type_identifier,
)

logger = logging.getLogger(__name__)


class HITLWorkflowService:
    """
    A service for helping pause and resume a HITL workflow.
    """

    # A key in context that stores the HITL event type
    HITL_CONTEXT_KEY = "human_response_type"

    @staticmethod
    def get_storage_path(id: str) -> Path:
        storage_dir = Path("output") / "checkpoints"
        if not storage_dir.exists():
            storage_dir.mkdir(parents=True, exist_ok=True)
        return storage_dir / f"{id}.json"

    @classmethod
    async def save_context(
        cls,
        id: str,
        ctx: Context,
        resume_event_type: Type[HumanResponseEvent],
    ) -> None:
        """
        Save the current checkpoint to a file and return the id

        Args:
            id: The id to save the context to.
            ctx: The context to save.
            resume_event_type [Optional]: Save workflow context with a resume event.
        """
        await ctx.set(
            key=cls.HITL_CONTEXT_KEY,
            value=type_identifier(resume_event_type),
        )

        ctx_data = ctx.to_dict(serializer=JsonSerializer())
        with open(cls.get_storage_path(id), "w") as f:
            json.dump(ctx_data, f)

    @classmethod
    async def load_context(
        cls,
        id: str,
        workflow: Workflow,
        data: dict,
    ) -> Context:
        file_path = cls.get_storage_path(id)
        if not file_path.exists():
            raise FileNotFoundError(f"No checkpoint found for id: {id}")
        try:
            with open(file_path, "r") as f:
                ctx_data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid checkpoint data for id {id}: {e}")
        ctx = Context.from_dict(
            workflow=workflow,
            data=ctx_data,
            serializer=JsonSerializer(),
        )
        resume_event = await cls._construct_resume_event(ctx, data)
        ctx.send_event(resume_event)
        return ctx

    @classmethod
    async def _construct_resume_event(
        cls, context: Context, data: dict
    ) -> HumanResponseEvent:
        """
        Get the HITL event from the context.
        """
        event_type_str = await context.get(cls.HITL_CONTEXT_KEY)
        if not event_type_str:
            raise ValueError(
                "Cannot resume the workflow because there is no resume event type in the context"
            )
        resume_event_type = type_from_identifier(event_type_str)
        if not issubclass(resume_event_type, HumanResponseEvent):
            raise ValueError(
                f"Cannot resume the workflow because the resume event type {resume_event_type} is not a HumanResponseEvent"
            )
        try:
            return resume_event_type(**data)
        except Exception as e:
            raise ValueError(
                f"Error constructing resume event: {e}. "
                f"Make sure the provided data is valid for the event type {resume_event_type}"
            )

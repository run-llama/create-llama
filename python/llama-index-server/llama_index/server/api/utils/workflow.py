import json
from pathlib import Path
from typing import Optional, Type

from llama_index.core.workflow import (
    Context,
    Event,
    JsonSerializer,
    Workflow,
)
from llama_index.core.workflow.handler import WorkflowHandler
from llama_index.server.models.hitl import HumanInputEvent
from llama_index.server.utils.class_meta_serialization import (
    type_from_identifier,
    type_identifier,
)


class HITLWorkflowService:
    # A key in context that stores the HITL event type
    HITL_CONTEXT_KEY = "human_response_type"

    @staticmethod
    def get_storage_path(chat_id: str) -> Path:
        storage_dir = Path("output") / "checkpoints"
        if not storage_dir.exists():
            storage_dir.mkdir(parents=True, exist_ok=True)
        return storage_dir / f"{chat_id}.json"

    @classmethod
    async def save_context(
        cls,
        chat_id: str,
        ctx: Context,
        hitl_event: Optional[HumanInputEvent] = None,
    ) -> None:
        """
        Save the current checkpoint to a file and return the chat_id

        Args:
            chat_id: The chat_id to save the context to.
            ctx: The context to save.
            hitl_event [Optional]: Save workflow context with a HITL event.
        """
        if hitl_event:
            await cls.attach_hitl_event(ctx, hitl_event)
        ctx_data = ctx.to_dict(serializer=JsonSerializer())
        with open(cls.get_storage_path(chat_id), "w") as f:
            json.dump(ctx_data, f)

    @classmethod
    def load_context(
        cls,
        chat_id: str,
        workflow: Workflow,
    ) -> Context:
        file_path = cls.get_storage_path(chat_id)
        if not file_path.exists():
            raise FileNotFoundError(f"No checkpoint found for chat_id: {chat_id}")
        try:
            with open(file_path, "r") as f:
                ctx_data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid checkpoint data for chat_id {chat_id}: {e}")
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

    @classmethod
    async def attach_hitl_event(cls, context: Context, event: HumanInputEvent) -> None:
        """
        Attach the HITL event to the context.
        """
        await context.set(
            key=cls.HITL_CONTEXT_KEY,
            value=type_identifier(event.response_event_type),
        )

    @classmethod
    async def get_hitl_event_type(cls, context: Context) -> Type[Event]:
        """
        Get the HITL event from the context.
        """
        response_event_type_str = await context.get(cls.HITL_CONTEXT_KEY)
        if not response_event_type_str:
            raise ValueError(
                "Do not have HITLContext in the context"
                "You need to pass a previous context that has HITLContext attached"
            )
        response_event_type = type_from_identifier(response_event_type_str)
        return response_event_type

    @classmethod
    async def resume_with_hitl_response(
        cls,
        workflow: Workflow,
        data: dict,
        request_id: str,
    ) -> WorkflowHandler:
        """
        Resume the workflow with the HITL response.
        """
        context = cls.load_context(request_id, workflow)
        hitl_event_type = await cls.get_hitl_event_type(context)
        context.send_event(hitl_event_type(**data))
        await cls.save_context(request_id, context)
        return workflow.run(ctx=context)

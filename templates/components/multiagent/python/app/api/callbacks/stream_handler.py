import logging
from typing import List, Optional

from llama_index.core.workflow.handler import WorkflowHandler

from app.api.callbacks.base import EventCallback

logger = logging.getLogger("uvicorn")


class StreamHandler:
    """
    Streams events from a workflow handler through a chain of callbacks.
    """

    def __init__(
        self,
        workflow_handler: WorkflowHandler,
        callbacks: Optional[List[EventCallback]] = None,
    ):
        self.workflow_handler = workflow_handler
        self.callbacks = callbacks or []
        self.accumulated_text = ""

    async def cancel_run(self):
        """Cancel the workflow handler."""
        await self.workflow_handler.cancel_run()

    async def stream_events(self):
        """Stream events through the processor chain."""
        try:
            async for event in self.workflow_handler.stream_events():
                # Process the event through each processor
                for callback in self.callbacks:
                    event = await callback.run(event)
                yield event

            # After all events are processed, call on_complete for each callback
            for callback in self.callbacks:
                result = await callback.on_complete(self.accumulated_text)
                if result:
                    yield result

        except Exception as e:
            # Make sure to cancel the workflow on error
            await self.workflow_handler.cancel_run()
            raise e

    async def accumulate_text(self, text: str):
        """Accumulate text from the workflow handler."""
        self.accumulated_text += text

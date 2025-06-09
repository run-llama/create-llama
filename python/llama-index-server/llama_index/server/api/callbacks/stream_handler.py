import logging
from typing import Any, AsyncGenerator, List, Optional

from llama_index.core.workflow.handler import WorkflowHandler
from llama_index.server.api.callbacks.base import EventCallback

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

    async def cancel_run(self) -> None:
        """Cancel the workflow handler."""
        await self.workflow_handler.cancel_run()

    async def wait_for_completion(self) -> Any:
        """Wait for the workflow to finish."""
        await self.workflow_handler

    async def stream_events(self) -> AsyncGenerator[Any, None]:
        """Stream events through the processor chain."""
        try:
            async for event in self.workflow_handler.stream_events():
                events_to_process = [event]
                for callback in self.callbacks:
                    next_events: list[Any] = []
                    for evt in events_to_process:
                        callback_output = await callback.run(evt)
                        if isinstance(callback_output, (list, tuple)):
                            next_events.extend(callback_output)
                        elif callback_output is not None:
                            next_events.append(callback_output)
                    events_to_process = next_events

                # Yield all processed events
                for evt in events_to_process:
                    yield evt

            # After all events are processed, call on_complete for each callback
            for callback in self.callbacks:
                result = await callback.on_complete(self.accumulated_text)
                if result:
                    yield result

        except Exception:
            # Make sure to cancel the workflow on error
            await self.workflow_handler.cancel_run()
            raise

    def accumulate_text(self, text: str) -> None:
        """Accumulate text from the workflow handler."""
        self.accumulated_text += text

    @classmethod
    def from_default(
        cls,
        handler: WorkflowHandler,
        callbacks: Optional[List[EventCallback]] = None,
    ) -> "StreamHandler":
        """Create a new instance with the given workflow handler and callbacks."""
        return cls(workflow_handler=handler, callbacks=callbacks)

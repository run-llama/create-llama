import asyncio
from typing import AsyncGenerator, Dict, Any, List, Optional

from llama_index.core.callbacks.base import BaseCallbackHandler
from llama_index.core.callbacks.schema import CBEventType, EventPayload
from pydantic import BaseModel


class CallbackEvent(BaseModel):
    event_type: CBEventType
    payload: Optional[Dict[str, Any]] = None
    event_id: str = ""

    def get_title(self):
        # TODO: we get two CBEventType.RETRIEVE events
        # For the on_event_start we should render:
        # "Retrieving context for query <query_str>"
        # For the on_event_end we should render:
        # "Retrieved <nodes> sources to use as context for the query"
        return self.event_id


class EventCallbackHandler(BaseCallbackHandler):
    _aqueue: asyncio.Queue
    is_done: False

    def __init__(
        self,
    ):
        """Initialize the base callback handler."""
        ignored_events = [
            CBEventType.CHUNKING,
            CBEventType.NODE_PARSING,
            CBEventType.EMBEDDING,
            CBEventType.LLM,
        ]
        super().__init__(ignored_events, ignored_events)
        self._aqueue = asyncio.Queue()

    def on_event_start(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: str = "",
        **kwargs: Any,
    ) -> str:
        self._aqueue.put_nowait(
            CallbackEvent(event_id=event_id, event_type=event_type, payload=payload)
        )

    def on_event_end(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: str = "",
        **kwargs: Any,
    ) -> None:
        self._aqueue.put_nowait(
            CallbackEvent(event_id=event_id, event_type=event_type, payload=payload)
        )

    def start_trace(self, trace_id: Optional[str] = None) -> None:
        """No-op."""

    def end_trace(
        self,
        trace_id: Optional[str] = None,
        trace_map: Optional[Dict[str, List[str]]] = None,
    ) -> None:
        """No-op."""

    async def async_event_gen(self) -> AsyncGenerator[CallbackEvent, None]:
        while True:
            if not self._aqueue.empty() or not self.is_done:
                try:
                    event = await asyncio.wait_for(self._aqueue.get(), timeout=0.1)
                except asyncio.TimeoutError:
                    if self.is_done:
                        break
                    continue
                yield event
            else:
                break

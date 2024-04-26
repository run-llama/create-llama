import asyncio
from typing import AsyncGenerator, Dict, Any, List, Optional

from llama_index.core.callbacks.base import BaseCallbackHandler
from llama_index.core.callbacks.schema import CBEventType
from pydantic import BaseModel


class CallbackEvent(BaseModel):
    event_type: CBEventType
    payload: Optional[Dict[str, Any]] = None
    event_id: str = ""

    def get_title(self) -> str | None:
        # Return as None for the unhandled event types
        # to avoid showing them in the UI
        match self.event_type:
            case "retrieve":
                if self.payload:
                    nodes = self.payload.get("nodes")
                    if nodes:
                        return f"Retrieved {len(nodes)} sources to use as context for the query"
                    else:
                        return f"Retrieving context for query: '{self.payload.get('query_str')}'"
                else:
                    return None
            case _:
                return None


class EventCallbackHandler(BaseCallbackHandler):
    _aqueue: asyncio.Queue
    is_done: bool = False

    def __init__(
        self,
    ):
        """Initialize the base callback handler."""
        ignored_events = [
            CBEventType.CHUNKING,
            CBEventType.NODE_PARSING,
            CBEventType.EMBEDDING,
            CBEventType.LLM,
            CBEventType.TEMPLATING,
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
        event = CallbackEvent(event_id=event_id, event_type=event_type, payload=payload)
        if event.get_title() is not None:
            self._aqueue.put_nowait(event)

    def on_event_end(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: str = "",
        **kwargs: Any,
    ) -> None:
        event = CallbackEvent(event_id=event_id, event_type=event_type, payload=payload)
        if event.get_title() is not None:
            self._aqueue.put_nowait(event)

    def start_trace(self, trace_id: Optional[str] = None) -> None:
        """No-op."""

    def end_trace(
        self,
        trace_id: Optional[str] = None,
        trace_map: Optional[Dict[str, List[str]]] = None,
    ) -> None:
        """No-op."""

    async def async_event_gen(self) -> AsyncGenerator[CallbackEvent, None]:
        while not self._aqueue.empty() or not self.is_done:
            try:
                yield await asyncio.wait_for(self._aqueue.get(), timeout=0.1)
            except asyncio.TimeoutError:
                pass

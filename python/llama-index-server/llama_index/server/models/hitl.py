from typing import Any, Dict, Type, Union

from llama_index.core.workflow.events import (
    HumanResponseEvent as FrameworkHumanResponseEvent,
)
from llama_index.core.workflow.events import InputRequiredEvent
from pydantic import BaseModel, Field


class HumanResponseEvent(FrameworkHumanResponseEvent):
    """
    Use this event to send a response from a human.
    """

    def __init__(self, **kwargs: Any) -> None:
        if "response" not in kwargs:
            kwargs["response"] = f"Human response with data: {kwargs.get('data', {})}"
        super().__init__(**kwargs)


class HumanInputEvent(InputRequiredEvent):
    """
    Use this event to request input from a human.
    It will block the workflow execution until the human responds.
    """

    response_event_type: Type[HumanResponseEvent] = Field(
        description="The type of event that the workflow is waiting for.",
    )
    event_type: str = Field(
        description="An identifier for the UI component that will be used to render the input.",
    )
    data: Union[Dict[str, Any], BaseModel] = Field(
        description="The data to be sent to the UI component that will be used to render the input.",
    )

    def __init__(self, **kwargs: Any) -> None:
        # Construct the prefix for InputRequiredEvent
        event_type = kwargs.get("event_type", None)
        data = kwargs.get("data", None)
        if "prefix" not in kwargs:
            kwargs["prefix"] = f"Need input for {event_type} with data: {data}"
        super().__init__(**kwargs)

    def to_response(self) -> dict:
        return {
            "type": self.event_type,
            "data": self.data
            if isinstance(self.data, dict)
            else self.data.model_dump(),
        }

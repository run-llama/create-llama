from typing import Type

from pydantic import BaseModel, Field

from llama_index.server.models import HumanInputEvent, HumanResponseEvent


class CLIHumanResponseEvent(HumanResponseEvent):
    execute: bool = Field(
        description="True if the human wants to execute the command, False otherwise."
    )
    command: str = Field(description="The command to execute.")


class CLICommand(BaseModel):
    command: str = Field(description="The command to execute.")


# We need an event that extends from HumanInputEvent for HITL feature
class CLIHumanInputEvent(HumanInputEvent):
    """
    CLIInputRequiredEvent is sent when the agent needs permission from the user to execute the CLI command or not.
    Render this event by showing the command and a boolean button to execute the command or not.
    """

    event_type: str = (
        "cli_human_input"  # used by UI to render with appropriate component
    )
    response_event_type: Type = (
        CLIHumanResponseEvent  # used by workflow to resume with the correct event
    )
    data: CLICommand = Field(  # the data that sent to the UI for rendering
        description="The command to execute.",
    )

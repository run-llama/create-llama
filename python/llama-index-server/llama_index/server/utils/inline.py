import json
import re
from typing import Any, List

from pydantic import ValidationError

from llama_index.core.workflow.events import Event
from llama_index.server.models.chat import ChatAPIMessage
from llama_index.core.agent.workflow.workflow_events import AgentStream

INLINE_ANNOTATION_KEY = (
    "annotation"  # the language key to detect inline annotation code in markdown
)


def get_inline_annotations(message: ChatAPIMessage) -> List[Any]:
    """Extract inline annotations from a chat message."""
    markdown_content = message.content

    inline_annotations: List[Any] = []

    # Regex to match annotation code blocks
    # Matches ```annotation followed by content until closing ```
    annotation_regex = re.compile(
        rf"```{re.escape(INLINE_ANNOTATION_KEY)}\s*\n([\s\S]*?)\n```", re.MULTILINE
    )

    for match in annotation_regex.finditer(markdown_content):
        json_content = match.group(1).strip() if match.group(1) else None

        if not json_content:
            continue

        try:
            # Parse the JSON content
            parsed = json.loads(json_content)

            # Check for required fields in the parsed annotation
            if (
                not isinstance(parsed, dict)
                or "type" not in parsed
                or "data" not in parsed
            ):
                continue

            # Extract the annotation data
            inline_annotations.append(parsed)
        except (json.JSONDecodeError, ValidationError) as error:
            # Skip invalid annotations - they might be malformed JSON or invalid schema
            print(f"Failed to parse annotation: {error}")

    return inline_annotations


def to_inline_annotation(item: dict) -> str:
    """
    To append inline annotations to the stream, we need to wrap the annotation in a code block with the language key.
    The language key is `annotation` and the code block is wrapped in backticks.

    ```annotation
    {
      "type": "artifact",
      "data": {...}
    }
    ```
    """
    return f"\n```{INLINE_ANNOTATION_KEY}\n{json.dumps(item)}\n```\n"


def to_inline_annotation_event(event: Event) -> AgentStream:
    """
    Convert an event to an AgentStream with inline annotation format.
    """
    event_dict = event.model_dump()
    return AgentStream(
        delta=to_inline_annotation(event_dict),
        response="",
        current_agent_name="assistant",
        tool_calls=[],
        raw=event_dict,
    )

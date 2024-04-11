import json
from typing import Any
from fastapi.responses import StreamingResponse


class VercelStreamResponse(StreamingResponse):
    """
    Class to convert the response from the chat engine to the streaming format expected by Vercel
    """

    TEXT_PREFIX = "0:"
    DATA_PREFIX = "8:"

    @classmethod
    def convert_text(cls, token: str):
        # Escape newlines to avoid breaking the stream
        token = token.replace("\n", "\\n")
        return f'{cls.TEXT_PREFIX}"{token}"\n'

    @classmethod
    def convert_data(cls, data: dict):
        data_str = json.dumps(data)
        return f"{cls.DATA_PREFIX}[{data_str}]\n"

    def __init__(self, content: Any, **kwargs):
        super().__init__(
            content=content,
            **kwargs,
        )

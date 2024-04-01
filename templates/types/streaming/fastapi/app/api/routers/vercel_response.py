import json
from typing import Any
from fastapi.responses import StreamingResponse


class VercelStreamResponse(StreamingResponse):
    """
    Class to convert the response from the chat engine to the streaming format expected by Vercel
    """

    TEXT_PREFIX = "0:"
    DATA_PREFIX = "2:"
    VERCEL_HEADERS = {
        "X-Experimental-Stream-Data": "true",
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Expose-Headers": "X-Experimental-Stream-Data",
    }

    @classmethod
    def convert_text(cls, token: str):
        return f'{cls.TEXT_PREFIX}"{token}"\n'

    @classmethod
    def convert_data(cls, data: dict):
        data_str = json.dumps(data)
        return f"{cls.DATA_PREFIX}[{data_str}]\n"

    def __init__(self, content: Any, **kwargs):
        super().__init__(
            content=content,
            headers=self.VERCEL_HEADERS,
            **kwargs,
        )

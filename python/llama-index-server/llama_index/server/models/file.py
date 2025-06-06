from typing import Optional

from pydantic import BaseModel, Field


class ServerFileResponse(BaseModel):
    id: str
    type: Optional[str] = None
    size: Optional[int] = None
    url: Optional[str] = None


class ServerFile(BaseModel):
    id: str
    path: str = Field(description="The path of the file in the server")
    type: Optional[str] = None
    size: Optional[int] = None
    url: Optional[str] = None

    def to_server_file_response(self) -> ServerFileResponse:
        return ServerFileResponse(
            id=self.id,
            type=self.type,
            size=self.size,
            url=self.url,
        )

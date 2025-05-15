from pydantic import Field, validator
from pydantic_settings import BaseSettings


class ServerSettings(BaseSettings):
    url: str = Field(
        default="",
        description="The deployment URL of the server, to be referenced by tools and file services",
    )
    api_prefix: str = Field(
        default="/api",
        description="The prefix for the API endpoints",
    )
    workflow_factory_signature: str = Field(
        default="",
        description="The signature of the workflow factory function",
    )

    @property
    def file_server_url_prefix(self) -> str:
        return f"{self.url}{self.api_prefix}/files"

    @property
    def api_url(self) -> str:
        return f"{self.url}{self.api_prefix}"

    @validator("url")
    def validate_url(cls, v: str) -> str:
        if v.endswith("/"):
            raise ValueError("URL must not end with a '/'")
        return v

    @validator("api_prefix")
    def validate_api_prefix(cls, v: str) -> str:
        if not v.startswith("/"):
            raise ValueError("API prefix must start with a '/'")
        return v

    def set_url(self, v: str) -> None:
        self.url = v
        self.validate_url(v)  # type: ignore

    def set_api_prefix(self, v: str) -> None:
        self.api_prefix = v
        self.validate_api_prefix(v)  # type: ignore

    def set_workflow_factory(self, v: str) -> None:
        self.workflow_factory_signature = v

    class Config:
        env_file_encoding = "utf-8"


server_settings = ServerSettings()

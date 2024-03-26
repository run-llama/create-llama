import os
import json
from pydantic import BaseModel, Field
from llama_index.readers.web import WholeSiteReader


class WebLoaderConfig(BaseModel):
    base_url: str
    prefix: str
    max_depth: int = Field(default=1, ge=0)


def get_web_documents(config: WebLoaderConfig):
    scraper = WholeSiteReader(
        prefix=config.prefix,
        max_depth=config.max_depth,
    )
    return scraper.load_data(config.base_url)

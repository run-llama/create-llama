import os
import json
from pydantic import BaseModel, Field
from llama_index.readers.web import WholeSiteReader


class LoaderConfig(BaseModel):
    base_url: str
    prefix: str
    max_depth: int = Field(default=1, ge=0)


def load_configs():
    with open("loaders.json") as f:
        configs = json.load(f)
    web_config = configs.get("web", None)
    if web_config is None:
        raise ValueError("No web config found in loaders.json")
    print(web_config)
    return [LoaderConfig(**config) for config in web_config]


def get_documents():
    web_config = load_configs()
    documents = []
    for config in web_config:
        scraper = WholeSiteReader(
            prefix=config.prefix,
            max_depth=config.max_depth,
        )
        documents.extend(scraper.load_data(config.base_url))
    return documents

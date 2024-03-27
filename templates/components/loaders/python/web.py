import os
import json
from pydantic import BaseModel, Field


class WebLoaderConfig(BaseModel):
    base_url: str
    prefix: str
    max_depth: int = Field(default=1, ge=0)


def get_web_documents(config: WebLoaderConfig):
    from llama_index.readers.web import WholeSiteReader
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options

    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    scraper = WholeSiteReader(
        prefix=config.prefix,
        max_depth=config.max_depth,
        driver=webdriver.Chrome(options=options),
    )
    return scraper.load_data(config.base_url)

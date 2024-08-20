IMPORTS = """
from llama_index.core.schema import BaseModel, Field
from typing import List, Optional
from datetime import date
"""

DEFAULT_MODEL = """class Output(BaseModel):
    response: str = Field(..., description="The answer to the question.")
    page_numbers: List[int] = Field(
        ...,
        description="The page numbers of the sources used to answer this question. Do not include a page number if the context is irrelevant.",
    )
    confidence: float = Field(
        ...,
        ge=0,
        le=1,
        description="Confidence value between 0-1 of the correctness of the result.",
    )
    confidence_explanation: str = Field(
        ..., description="Explanation for the confidence score"
    )
"""

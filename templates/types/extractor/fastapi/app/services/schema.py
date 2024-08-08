from typing import Optional

from app.models.output import Output
from pydantic import BaseModel

DEFAULT_MODEL = Output


class SchemaService:
    def __init__(self, model: Optional[BaseModel] = None):
        if model is None:
            model = DEFAULT_MODEL
        self._model = model

    def model(self) -> BaseModel:
        return self._model

    def get_current_schema(self) -> str:
        return self._model.schema_json(indent=2)

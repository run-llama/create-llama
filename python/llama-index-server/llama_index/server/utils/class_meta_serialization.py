import importlib
from typing import Type


def type_identifier(type: Type) -> str:
    """
    Get the identifier of a type.
    """
    return f"{type.__module__}.{type.__qualname__}"


def type_from_identifier(identifier: str) -> Type:
    """
    Get the type from an identifier.
    """
    module, qualname = identifier.rsplit(".", 1)
    return getattr(importlib.import_module(module), qualname)

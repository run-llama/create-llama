# Helper functions for serializing and deserializing class metadata.
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
    if not identifier or "." not in identifier:
        raise ValueError(f"Invalid type identifier format: {identifier}")
    try:
        module, qualname = identifier.rsplit(".", 1)
        imported_module = importlib.import_module(module)
        if not hasattr(imported_module, qualname):
            raise AttributeError(f"Module '{module}' has no attribute '{qualname}'")
        return getattr(imported_module, qualname)
    except ImportError as e:
        raise ImportError(f"Failed to import module '{module}': {e}")
    except Exception as e:
        raise RuntimeError(
            f"Failed to resolve type from identifier '{identifier}': {e}"
        )

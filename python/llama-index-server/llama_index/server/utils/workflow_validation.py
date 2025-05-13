"""
Utilities for validating workflow.py files (syntax and import checks only).
"""

import ast
import importlib.util
from typing import Optional


def validate_workflow_file(
    workflow_path: Optional[str] = None,
    workflow_content: Optional[str] = None,
    factory_signature: Optional[str] = None,
) -> None:
    """
    Validate that the workflow file is syntactically correct, can be imported, and defines a callable factory function with the given name.
    Raises an exception if invalid.
    """
    if workflow_path is None and workflow_content is None:
        raise ValueError("Either workflow_path or workflow_content must be provided")

    # 1. Syntax check
    if workflow_path is not None:
        with open(workflow_path, "r") as f:
            content = f.read()
    else:
        if workflow_content is None:
            raise ValueError(
                "workflow_content must be provided if workflow_path is not specified"
            )
        content = workflow_content
    try:
        ast.parse(content)
    except SyntaxError as e:
        raise ValueError(f"Syntax error in workflow: {e}")

    # 2. Import check (will catch missing modules, etc.)
    spec = importlib.util.spec_from_file_location("workflow", workflow_path)
    if spec is None or spec.loader is None:
        raise ValueError(f"Could not load module specification for {workflow_path}")

    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except Exception as e:
        raise ValueError(f"Import error: {e}")

    # 3. Contract validation: require the given factory function name
    if factory_signature:
        if not hasattr(mod, factory_signature):
            raise ValueError(f"Missing required function: '{factory_signature}'")
        obj = getattr(mod, factory_signature)
        if not callable(obj):
            raise ValueError(f"'{factory_signature}' is not callable")

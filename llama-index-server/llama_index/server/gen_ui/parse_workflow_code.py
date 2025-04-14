import ast
import importlib
import inspect
import os
import sys
import typing
from typing import Any, Dict, List, Optional, Set, Type


class EventAnalyzer(ast.NodeVisitor):
    """
    Parse the workflow code to find all UIEvent used in write_event_to_stream.
    """

    def __init__(self):
        self.ui_events: Set[str] = set()

    def visit_Call(self, node: ast.Call) -> None:
        # Check for ctx.write_event_to_stream(UIEvent(...))
        if (
            isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.attr == "write_event_to_stream"
            and node.args
            and isinstance(node.args[0], ast.Call)
            and isinstance(node.args[0].func, ast.Name)
            and node.args[0].func.id == "UIEvent"
        ):
            self.ui_events.add("UIEvent")
        self.generic_visit(node)


def get_pydantic_schema(
    model_class: Type[Any], visited: Optional[Set[str]] = None
) -> Optional[Dict[str, Any]]:
    """
    Get schema for a Pydantic model, enhancing with descriptions/titles.
    """
    if visited is None:
        visited = set()

    if inspect.isclass(model_class) and hasattr(model_class, "model_json_schema"):
        if model_class.__name__ in visited:
            return {"type": model_class.__name__, "recursive": True}
        visited.add(model_class.__name__)

        schema = model_class.model_json_schema()

        # Enhance with docstring
        if hasattr(model_class, "__doc__") and model_class.__doc__:
            if "description" not in schema or not schema["description"]:
                schema["description"] = model_class.__doc__.strip()
        if hasattr(model_class, "__name__"):
            if "title" not in schema or not schema["title"]:
                schema["title"] = model_class.__name__

        # Enhance with model_fields info (Pydantic v2)
        if hasattr(model_class, "model_fields"):
            for field_name, field in model_class.model_fields.items():
                if field_name in schema.get("properties", {}):
                    prop = schema["properties"][field_name]
                    if field.description and (
                        "description" not in prop or not prop["description"]
                    ):
                        prop["description"] = field.description
                    if (
                        hasattr(field, "title")
                        and field.title
                        and ("title" not in prop or not prop["title"])
                    ):
                        prop["title"] = field.title
        return schema
    return None


def get_ui_events_and_schemas(file_path: str) -> List[Dict[str, Any]]:
    """Find UIEvent, get the schema of its data field's type via introspection,
    and return a list of full schemas.
    """
    # Get absolute paths for module importing
    abs_file_path = os.path.abspath(file_path)
    project_root = os.path.dirname(os.path.dirname(abs_file_path))

    # Convert file path to module name
    rel_path = os.path.relpath(abs_file_path, project_root)
    module_name = rel_path.replace(os.sep, ".").replace(".py", "")

    # Temporarily modify sys.path to allow imports
    original_path = list(sys.path)
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

    module = None
    try:
        module = importlib.import_module(module_name)
        importlib.reload(module)
    except ImportError as e:
        print(f"Error importing module {module_name}: {e}")
        print(f"Current sys.path: {sys.path}")
        sys.path = original_path
        return []
    finally:
        if project_root in sys.path and project_root not in original_path:
            try:
                sys.path.remove(project_root)
            except ValueError:
                pass

    # Use AST only to find UIEvent *usage*
    try:
        with open(file_path, "r") as f:
            tree = ast.parse(f.read())
    except FileNotFoundError:
        print(f"Error: File not found {file_path}")
        return []
    except SyntaxError as e:
        print(f"Error parsing {file_path}: {e}")
        return []

    analyzer = EventAnalyzer()
    analyzer.visit(tree)

    schema_list = []

    # If UIEvent usage was found via AST, use introspection on the loaded module
    if "UIEvent" in analyzer.ui_events and hasattr(module, "UIEvent"):
        ui_event_class = getattr(module, "UIEvent")
        if inspect.isclass(ui_event_class):
            data_field_type = None
            try:
                globalns = getattr(sys.modules[module.__name__], "__dict__", None)
                type_hints = typing.get_type_hints(ui_event_class, globalns=globalns)
                if "data" in type_hints:
                    data_field_type = type_hints["data"]
            except Exception as e:
                print(
                    f"Warning: Could not resolve type hints for {ui_event_class.__name__}: {e}"
                )
                if (
                    hasattr(ui_event_class, "model_fields")
                    and "data" in ui_event_class.model_fields
                ):
                    field_info = ui_event_class.model_fields["data"]
                    if inspect.isclass(field_info.annotation):
                        data_field_type = field_info.annotation

            if inspect.isclass(data_field_type):
                schema = get_pydantic_schema(data_field_type)
                if schema is not None:
                    schema_list.append(schema)
            else:
                print(
                    f"Warning: Found UIEvent usage but could not determine class type for 'data' field in {ui_event_class.__name__}"
                )

    return schema_list
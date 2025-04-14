import ast
import importlib
import inspect
import sys
from typing import Any, Dict, Optional, Set, Type


class EventAnalyzer(ast.NodeVisitor):
    """
    Parse the workflow code to find all UIEvent used in write_event_to_stream and its schema.
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
    Get schema for a Pydantic model's data field if it has both type and data fields.
    """
    if visited is None:
        visited = set()

    # Get all class attributes including those from parent classes
    fields = {}
    for base in model_class.__mro__:
        if hasattr(base, "__annotations__"):
            fields.update(base.__annotations__)

    # Check if the model has both 'type' and 'data' fields
    if "type" not in fields or "data" not in fields:
        return None

    # Get the data field's type
    data_type = fields["data"]

    # If data field is another class type, get its schema
    if inspect.isclass(data_type) and hasattr(data_type, "model_json_schema"):
        if data_type.__name__ in visited:
            return {"type": data_type.__name__, "recursive": True}

        visited.add(data_type.__name__)
        schema = data_type.model_json_schema()

        # Preserve title and description if available
        if hasattr(data_type, "__doc__") and data_type.__doc__:
            schema["description"] = data_type.__doc__.strip()

        # If it's a Pydantic model, get field descriptions from model_fields
        if hasattr(data_type, "model_fields"):
            for field_name, field in data_type.model_fields.items():
                if field_name in schema.get("properties", {}):
                    if field.description:
                        schema["properties"][field_name]["description"] = (
                            field.description
                        )
                    if hasattr(field, "title") and field.title:
                        schema["properties"][field_name]["title"] = field.title

        return schema

    return None


def get_ui_events_and_schemas(
    file_path: str,
) -> tuple[Set[str], Dict[str, Dict[str, Any]]]:
    """Find UIEvent and its schema.

    Args:
        file_path: The path to the workflow file to generate UI from. e.g: `app/workflow.py`

    Returns:
        A tuple of the UIEvent and its schema.
    """
    # First get the module name from the file path
    module_name = file_path.replace("/", ".").replace(".py", "")
    if module_name.startswith("."):
        module_name = module_name[1:]

    # Add the current directory to Python path if not already there
    if "" not in sys.path:
        sys.path.insert(0, "")

    # Import the module to get access to the actual classes
    module = importlib.import_module(module_name)

    # Parse the file to find UIEvent usage
    with open(file_path, "r") as f:
        tree = ast.parse(f.read())

    analyzer = EventAnalyzer()
    analyzer.visit(tree)

    # Get schema for UIEvent if found
    schemas = {}
    if analyzer.ui_events and hasattr(module, "UIEvent"):
        ui_event = getattr(module, "UIEvent")
        if inspect.isclass(ui_event):
            schema = get_pydantic_schema(ui_event)
            if schema is not None:
                schemas["UIEvent"] = schema

    return analyzer.ui_events, schemas

import ast
import importlib
import inspect
import os
import sys
from typing import Any, Dict, List


class EventAnalyzer(ast.NodeVisitor):
    """
    Parse the workflow code to find UIEvent instances passed to write_event_to_stream.
    """

    def __init__(self) -> None:
        self.found_ui_event = False

    def visit_Call(self, node: ast.Call) -> None:
        # Check for ctx.write_event_to_stream call with UIEvent arg
        if (
            isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.attr == "write_event_to_stream"
            and node.args
            and isinstance(node.args[0], ast.Call)
            and isinstance(node.args[0].func, ast.Name)
            and node.args[0].func.id == "UIEvent"
        ):
            self.found_ui_event = True

        self.generic_visit(node)


def get_workflow_event_schemas(file_path: str) -> List[Dict[str, Any]]:
    """
    Find UIEvent instances passed to write_event_to_stream and return their data type schema.
    """
    # Get absolute path for module importing
    abs_file_path = os.path.abspath(file_path)
    project_root = os.path.dirname(os.path.dirname(abs_file_path))

    # Convert file path to module name
    rel_path = os.path.relpath(abs_file_path, project_root)
    module_name = rel_path.replace(os.sep, ".").replace(".py", "")

    # Temporarily modify sys.path to allow imports
    original_path = list(sys.path)
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

    try:
        # Import the module
        module = importlib.import_module(module_name)
        importlib.reload(module)
    except ImportError as e:
        print(f"Error importing module {module_name}: {e}")
        sys.path = original_path
        return []
    finally:
        # Restore original path
        if project_root in sys.path and project_root not in original_path:
            sys.path.remove(project_root)

    # Parse the file to check for UIEvent usage
    try:
        with open(file_path, "r") as f:
            tree = ast.parse(f.read())
    except (FileNotFoundError, SyntaxError) as e:
        print(f"Error parsing {file_path}: {e}")
        return []

    # Check if UIEvent is passed to write_event_to_stream
    analyzer = EventAnalyzer()
    analyzer.visit(tree)

    schema_list = []

    # Only proceed if UIEvent was found and the module has the class
    if analyzer.found_ui_event and hasattr(module, "UIEvent"):
        # Look for class names containing "EventData" in the module
        for name, obj in inspect.getmembers(module):
            if (
                inspect.isclass(obj)
                and name.endswith("EventData")
                and hasattr(obj, "model_json_schema")
            ):
                try:
                    schema = obj.model_json_schema()
                    if schema:
                        schema_list.append(schema)
                except Exception:
                    pass

    return schema_list

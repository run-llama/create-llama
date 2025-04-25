import logging
import os
from typing import List, Optional

from llama_index.server.api.models import ComponentDefinition


class CustomUI:
    def __init__(
        self, component_dir: str, logger: Optional[logging.Logger] = None
    ) -> None:
        self.component_dir = component_dir
        self.logger = logger or logging.getLogger(__name__)

    def get_components(self) -> List[ComponentDefinition]:
        """
        List all js files in the component directory and return a list of ComponentDefinition objects.
        Ignores files that fail to load and logs the error.
        TSX files take precedence over JSX files when duplicate component names are found.
        """
        components_dict: dict[str, ComponentDefinition] = {}
        if not os.path.exists(self.component_dir):
            self.logger.warning(
                f"Component directory {self.component_dir} does not exist"
            )
            return []
        try:
            for file in os.listdir(self.component_dir):
                if not file.endswith((".jsx", ".tsx")):
                    continue

                component_name = file.split(".")[0]
                file_path = os.path.join(self.component_dir, file)
                file_ext = os.path.splitext(file)[1]

                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        code = f.read()
                        new_component = ComponentDefinition(
                            type=component_name,
                            code=code,
                            filename=file,
                        )

                        if component_name in components_dict:
                            existing_ext = os.path.splitext(
                                components_dict[component_name].filename
                            )[1]

                            # If existing is TSX and new is JSX, skip and warn
                            if existing_ext == ".tsx" and file_ext == ".jsx":
                                self.logger.warning(
                                    f"Skipping duplicate JSX component {file} as TSX version already exists"
                                )
                                continue

                            # If both are same extension, warn and skip
                            if existing_ext == file_ext:
                                self.logger.warning(
                                    f"Skipping duplicate component {file} with same extension"
                                )
                                continue

                            # If existing is JSX and new is TSX, replace and warn
                            if existing_ext == ".jsx" and file_ext == ".tsx":
                                self.logger.warning(
                                    f"Replacing JSX component {components_dict[component_name].filename} with TSX version {file}"
                                )
                                components_dict[component_name] = new_component
                                continue

                        components_dict[component_name] = new_component

                except Exception as e:
                    self.logger.error(f"Failed to load component {file}: {str(e)}")
                    continue

        except Exception as e:
            self.logger.error(f"Error reading component directory: {str(e)}")

        return list(components_dict.values())

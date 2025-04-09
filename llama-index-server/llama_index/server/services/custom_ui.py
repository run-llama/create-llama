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
        """
        components: List[ComponentDefinition] = []
        if not os.path.exists(self.component_dir):
            self.logger.warning(
                f"Component directory {self.component_dir} does not exist"
            )
            return components
        try:
            for file in os.listdir(self.component_dir):
                if not file.endswith((".jsx", ".tsx")):
                    continue

                component_name = file.split(".")[0]
                file_path = os.path.join(self.component_dir, file)

                try:
                    with open(file_path, "r") as f:
                        code = f.read()
                        components.append(
                            ComponentDefinition(
                                type=component_name,
                                code=code,
                                filename=file,
                            )
                        )
                except Exception as e:
                    self.logger.error(f"Failed to load component {file}: {str(e)}")
                    continue

        except Exception as e:
            self.logger.error(f"Error reading component directory: {str(e)}")

        return components

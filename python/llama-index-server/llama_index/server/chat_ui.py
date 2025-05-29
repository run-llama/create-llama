import importlib.resources
import logging
import shutil
from pathlib import Path
from typing import Optional

PACKAGE_NAME = "llama_index.server.resources"
RESOURCE_DIR_NAME = "ui"


def check_ui_resources() -> None:
    """
    Checks if the UI resources directory exists in the specified package and lists its contents.
    Raises a FileNotFoundError with a clear message if the directory is missing.
    """
    try:
        _ = importlib.resources.files(PACKAGE_NAME).joinpath(RESOURCE_DIR_NAME)
    except Exception as e:
        raise Exception("UI resources not found in bundled package") from e


def copy_bundled_chat_ui(
    logger: Optional[logging.Logger] = None, target_path: str = ".ui"
) -> None:
    # Check if the UI resources directory exists
    check_ui_resources()

    if logger is None:
        logger = logging.getLogger("uvicorn")

    destination_path = Path(target_path)
    destination_path.mkdir(parents=True, exist_ok=True)

    try:
        # Clear the destination directory first to avoid stale files
        for item in destination_path.iterdir():
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()

        # Get a reference to the source directory using importlib.resources.files (Python 3.9+)
        source_dir_ref = importlib.resources.files(PACKAGE_NAME).joinpath(
            RESOURCE_DIR_NAME
        )

        if not source_dir_ref.is_dir():
            logger.error(
                f"Static UI resource directory '{RESOURCE_DIR_NAME}' not found in package '{PACKAGE_NAME}'. Path: {source_dir_ref}"
            )
            logger.error(
                "Ensure the static files are correctly bundled with the package and the path is correct."
            )
            return

        for source_item_path_ref in source_dir_ref.iterdir():
            # Skip __init__.py or other non-static files if present (though less likely needed with direct iteration)
            if source_item_path_ref.name.startswith(
                "__"
            ) or source_item_path_ref.name.endswith(".py"):
                continue

            dest_item_path = destination_path / source_item_path_ref.name

            # importlib.resources.as_file is needed to get a concrete path for shutil operations
            with importlib.resources.as_file(
                source_item_path_ref
            ) as concrete_source_item_path:
                if concrete_source_item_path.is_dir():
                    shutil.copytree(
                        concrete_source_item_path, dest_item_path, dirs_exist_ok=True
                    )
                elif concrete_source_item_path.is_file():
                    shutil.copy2(concrete_source_item_path, dest_item_path)
                else:
                    logger.warning(
                        f"Skipping resource '{source_item_path_ref.name}' as it's not a file or directory."
                    )

        logger.info(f"Chat UI files copied from package to '{destination_path}'")

    except FileNotFoundError:
        logger.error(
            "Oops! The chat UI files are not found. Please report this issue to the LlamaIndex team."
        )
    except Exception as e:
        logger.error(f"Failed to copy bundled chat UI files: {e}.")

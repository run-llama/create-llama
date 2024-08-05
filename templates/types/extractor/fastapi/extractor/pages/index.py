import reflex as rx

from ..components import (
    SchemaState,
    UploadedFilesState,
    extract_data_component,
    schema_editor_component,
    upload_component,
)
from ..templates import template


@template(
    route="/",
    title="Upload",
    on_load=[
        SchemaState.init_schema,
        UploadedFilesState.load_files,
    ]
)
def upload() -> rx.Component:
    """The upload page.

    Returns:
        The UI for the upload page.
    """
    return rx.stack(
        rx.vstack(
            upload_component(),
            rx.divider(),
            schema_editor_component(),
            width="50%",
        ),
        rx.divider(orientation="vertical"),
        rx.stack(
            extract_data_component(),
            width="50%",
        ),
        width="100%",
    )

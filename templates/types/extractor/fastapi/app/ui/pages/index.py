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
    title="Structure extractor",
    on_load=[
        SchemaState.init_schema,
        UploadedFilesState.load_files,
    ],
)
def index() -> rx.Component:
    """The main index page."""
    return rx.vstack(
        rx.vstack(
            rx.heading("Built by LlamaIndex", size="6"),
            rx.text(
                "Upload a file then enter the query to extract the data in the file according to the schema."
            ),
            background_color="var(--gray-3)",
            align_items="left",
            justify_content="left",
            width="100%",
            padding="1rem",
        ),
        rx.stack(
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
            padding="1rem",
        ),
        width="100%",
    )

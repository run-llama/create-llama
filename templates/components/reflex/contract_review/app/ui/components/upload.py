import reflex as rx

from app.ui.components.shared import card_component
from app.ui.states.app import AppState


def upload_component() -> rx.Component:
    return card_component(
        title="Upload",
        children=rx.container(
            rx.vstack(
                rx.upload(
                    rx.vstack(
                        rx.text("Drag and drop files here or click to select files"),
                    ),
                    on_drop=AppState.handle_upload(
                        rx.upload_files(upload_id="upload1")
                    ),
                    id="upload1",
                    border="1px dotted rgb(107,99,246)",
                    padding="1rem",
                ),
                rx.cond(
                    AppState.uploaded_file != None,  # noqa: E711
                    rx.text(AppState.uploaded_file.file_name),  # type: ignore
                    rx.text("No file uploaded"),
                ),
            ),
        ),
    )

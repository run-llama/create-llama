import reflex as rx

from app.ui.components.extractor import StructuredQuery
from .monaco import monaco


def schema_editor_component() -> rx.Component:
    return rx.vstack(
        rx.heading("Pydantic model", size="5"),
        monaco(
            default_language="python",
            default_value=StructuredQuery.code,
            width="100%",
            height="50vh",
            on_change=StructuredQuery.set_code,
        ),
        width="100%",
    )

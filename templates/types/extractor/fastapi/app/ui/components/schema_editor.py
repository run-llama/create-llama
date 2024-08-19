import reflex as rx

from app.ui.components.extractor import StructureQuery
from .monaco import monaco


def schema_editor_component() -> rx.Component:
    return rx.vstack(
        rx.heading("Update Pydantic model", size="5"),
        monaco(
            default_language="python",
            default_value=StructureQuery.code,
            width="100%",
            height="50vh",
            on_change=StructureQuery.set_code,
        ),
        width="100%",
    )

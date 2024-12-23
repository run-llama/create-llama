import reflex as rx

from app.ui.components import (
    guideline_component,
    load_contract_component,
    report_component,
    upload_component,
)
from app.ui.templates import template


@template(
    route="/",
    title="Structure extractor",
)
def index() -> rx.Component:
    """The main index page."""
    return rx.vstack(
        rx.vstack(
            rx.heading("Built by LlamaIndex", size="6"),
            rx.text(
                "Upload a contract to view the progress of the contract review.",
            ),
            background_color="var(--gray-3)",
            align_items="left",
            justify_content="left",
            width="100%",
            padding="1rem",
        ),
        rx.container(
            rx.vstack(
                # Upload
                upload_component(),
                # Workflow
                rx.vstack(
                    load_contract_component(),
                    guideline_component(),
                    report_component(),
                    width="100%",
                ),
            ),
            width="100%",
            padding="1rem",
        ),
        width="100%",
    )

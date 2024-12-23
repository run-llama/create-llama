import reflex as rx

from app.ui.components.shared import card_component
from app.ui.states.workflow import ReportState


def report_component() -> rx.Component:
    return rx.cond(
        ReportState.is_started,
        card_component(
            title="Report",
            show_loading=~ReportState.is_completed,  # type: ignore
            children=rx.cond(
                ReportState.is_completed,
                rx.vstack(
                    rx.text("Your report is ready to download"),
                    rx.button(
                        "Download",
                        on_click=rx.download(
                            url=ReportState.download_url,
                            filename="report.json",
                        ),
                    ),
                ),
                rx.vstack(
                    rx.text("Generating report..."),
                ),
            ),
        ),
    )

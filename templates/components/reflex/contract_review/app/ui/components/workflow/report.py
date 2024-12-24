import reflex as rx

from app.ui.components.shared import card_component
from app.ui.states.workflow import ReportState


def report_component() -> rx.Component:
    return rx.cond(
        ReportState.is_running,
        card_component(
            title="Conclusion",
            show_loading=~ReportState.is_completed,  # type: ignore
            children=rx.cond(
                ReportState.is_completed,
                rx.vstack(
                    rx.box(
                        rx.inset(
                            rx.table.root(
                                rx.table.body(
                                    rx.table.row(
                                        rx.table.cell("Vendor"),
                                        rx.table.cell(ReportState.result.vendor_name),  # type: ignore
                                    ),
                                    rx.table.row(
                                        rx.table.cell("Overall Compliance"),
                                        rx.table.cell(
                                            rx.cond(
                                                ReportState.result.overall_compliant,
                                                rx.text("Compliant", color="green"),
                                                rx.text("Non-compliant", color="red"),
                                            )
                                        ),
                                    ),
                                    rx.table.row(
                                        rx.table.cell("Summary Notes"),
                                        rx.table.cell(ReportState.result.summary_notes),  # type: ignore
                                    ),
                                ),
                            ),
                        )
                    ),
                ),
                rx.vstack(
                    rx.text("Analyzing compliance results for final conclusion..."),
                ),
            ),
        ),
    )

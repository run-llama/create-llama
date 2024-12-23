from typing import Any, Dict, List

import reflex as rx

from app.ui.components.shared import card_component
from app.ui.states.workflow import GuidelineData, GuidelineHandlerState, GuidelineState


def guideline_handler_component(item: List) -> rx.Component:
    _id: str = item[0]
    status: GuidelineData = item[1]

    return rx.hover_card.root(
        rx.hover_card.trigger(
            rx.card(
                rx.stack(
                    rx.container(
                        rx.cond(
                            ~status.is_completed,
                            rx.spinner(size="1"),
                            rx.cond(
                                status.is_compliant,
                                rx.icon(tag="check", color="green"),
                                rx.icon(tag="x", color="red"),
                            ),
                        ),
                    ),
                    rx.flex(
                        rx.text(status.clause_text, size="1"),
                    ),
                ),
            ),
        ),
        rx.hover_card.content(
            rx.cond(
                status.is_completed,
                guideline_output_component(status.output),  # type: ignore
                rx.spinner(size="1"),
            ),
            side="right",
        ),
    )


def guideline_output_component(output: Dict[str, Any]) -> rx.Component:
    return rx.inset(
        rx.table.root(
            rx.table.body(
                rx.table.row(
                    rx.table.cell("Clause"),
                    rx.table.cell(output.clause_text),  # type: ignore
                ),
                rx.table.row(
                    rx.table.cell("Notes"),
                    rx.table.cell(output.notes),  # type: ignore
                ),
            ),
        ),
    )


def guideline_component() -> rx.Component:
    return rx.cond(
        GuidelineState.is_started,
        card_component(
            title="Finding relevant guidelines",
            children=rx.vstack(
                rx.vstack(
                    rx.foreach(
                        GuidelineState.log,
                        lambda log: rx.box(
                            rx.text(log["msg"]),
                        ),
                    ),
                ),
                rx.cond(
                    GuidelineHandlerState.has_data(),  # type: ignore
                    rx.grid(
                        rx.foreach(
                            GuidelineHandlerState.data,
                            guideline_handler_component,
                        ),
                        columns="2",
                        spacing="1",
                    ),
                ),
            ),
            show_loading=GuidelineState.is_running,
        ),
    )

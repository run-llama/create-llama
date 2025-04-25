import reflex as rx

from app.ui.components.shared import card_component
from app.ui.states.workflow import ContractLoaderState


def load_contract_component() -> rx.Component:
    return rx.cond(
        ContractLoaderState.is_started,
        card_component(
            title="Parse contract",
            children=rx.vstack(
                rx.foreach(
                    ContractLoaderState.log,
                    lambda log: rx.box(
                        rx.text(log["msg"]),
                    ),
                ),
            ),
            show_loading=ContractLoaderState.is_running,
        ),
    )

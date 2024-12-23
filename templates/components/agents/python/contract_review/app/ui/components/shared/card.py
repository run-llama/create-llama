import reflex as rx


def card_component(
    title: str,
    children: rx.Component,
    show_loading: bool = False,
) -> rx.Component:
    return rx.card(
        rx.stack(
            rx.cond(show_loading, rx.spinner(size="2")),
            rx.text(title, size="4"),
        ),
        rx.divider(orientation="horizontal"),
        rx.container(children),
        width="100%",
        background_color="var(--gray-3)",
    )

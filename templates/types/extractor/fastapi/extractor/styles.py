import reflex as rx

border_radius = "var(--radius-2)"
border = f"1px solid {rx.color('gray', 5)}"
text_color = rx.color("gray", 11)
gray_color = rx.color("gray", 11)
gray_bg_color = rx.color("gray", 3)
accent_text_color = rx.color("accent", 10)
accent_color = rx.color("accent", 1)
accent_bg_color = rx.color("accent", 3)
hover_accent_color = {"_hover": {"color": accent_text_color}}
hover_accent_bg = {"_hover": {"background_color": accent_color}}
content_width_vw = "90vw"
sidebar_width = "32em"
sidebar_content_width = "16em"
max_width = "1480px"
color_box_size = ["2.25rem", "2.25rem", "2.5rem"]


template_page_style = {
    "padding_top": ["1em", "1em", "2em"],
    "padding_x": ["auto", "auto", "2em"],
}

template_content_style = {
    "padding": "1em",
    "margin_bottom": "2em",
    "min_height": "90vh",
}

link_style = {
    "color": accent_text_color,
    "text_decoration": "none",
    **hover_accent_color,
}

overlapping_button_style = {
    "background_color": "white",
    "border_radius": border_radius,
}

markdown_style = {
    "code": lambda text: rx.code(text, color_scheme="gray"),
    "codeblock": lambda text, **props: rx.code_block(text, **props, margin_y="1em"),
    "a": lambda text, **props: rx.link(
        text,
        **props,
        font_weight="bold",
        text_decoration="underline",
        text_decoration_color=accent_text_color,
    ),
}

notification_badge_style = {
    "width": "1.25rem",
    "height": "1.25rem",
    "display": "flex",
    "align_items": "center",
    "justify_content": "center",
    "position": "absolute",
    "right": "-0.35rem",
    "top": "-0.35rem",
}

ghost_input_style = {
    "--text-field-selection-color": "",
    "--text-field-focus-color": "transparent",
    "--text-field-border-width": "1px",
    "background-clip": "content-box",
    "background-color": "transparent",
    "box-shadow": "inset 0 0 0 var(--text-field-border-width) transparent",
    "color": "",
}

box_shadow_style = "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"

color_picker_style = {
    "border_radius": "max(var(--radius-3), var(--radius-full))",
    "box_shadow": box_shadow_style,
    "cursor": "pointer",
    "display": "flex",
    "align_items": "center",
    "justify_content": "center",
    "transition": "transform 0.15s ease-in-out",
    "_active": {
        "transform": "translateY(2px) scale(0.95)",
    },
}


base_stylesheets = [
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
    "styles.css",
]

base_style = {
    "font_family": "Inter",
}

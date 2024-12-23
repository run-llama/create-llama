"""Reflex custom component Monaco."""

# For wrapping react guide, visit https://reflex.dev/docs/wrapping-react/overview/
# Taken and modified from https://github.com/Lendemor/reflex-monaco

import reflex as rx


class MonacoComponent(rx.Component):
    """Base Monaco component."""

    library = "@monaco-editor/react@4.6.0"

    # The language to use for the editor.
    language: rx.Var[str]

    # The theme to use for the editor.
    theme: rx.Var[str] = rx.color_mode_cond("light", "vs-dark")  # type: ignore

    # The width of the editor.
    line: rx.Var[int] = rx.Var.create_safe(1, _var_is_string=False)

    # The height of the editor.
    width: rx.Var[str]

    # The height of the editor.
    height: rx.Var[str]


class MonacoEditor(MonacoComponent):
    """The Monaco Editor component."""

    # The React component tag.
    tag = "MonacoEditor"

    is_default = True

    # The default value to display in the editor.
    default_value: rx.Var[str]

    # The default language to use for the editor.
    default_language: rx.Var[str]

    # The path to the default file to load in the editor.
    default_path: rx.Var[str]

    # The value to display in the editor.
    value: rx.Var[str]

    # Triggered when the editor value changes.
    on_change: rx.EventHandler[lambda e: [e]]

    # Triggered when the content is validated. (limited to some languages)
    on_validate: rx.EventHandler[lambda e: [e]]

    options = {
        "minimap": {"enabled": False},
    }


monaco = MonacoEditor.create

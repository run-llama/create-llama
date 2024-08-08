import reflex as rx
from app.services.schema import SchemaService


class SchemaState(rx.State):
    schema: str

    def handle_schema(self, schema: str):
        self.schema = schema

    def init_schema(self):
        self.schema = SchemaService().get_current_schema()


def schema_editor_component() -> rx.Component:
    return rx.vstack(
        rx.heading("Update schema", size="5"),
        rx.text_area(
            id="schema",
            value=SchemaState.schema,
            size="3",
            resize="vertical",
            width="100%",
            height="50vh",
        ),
        width="100%",
    )

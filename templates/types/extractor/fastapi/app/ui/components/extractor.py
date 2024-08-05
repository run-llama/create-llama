import reflex as rx

from app.api.routers.extractor import RequestData, query_request

from .schema_editor import SchemaState


class StructureQuery(rx.State):
    query: str
    response: str

    def set_query(self, query: str):
        self.query = query

    async def handle_query(self):
        # Get current schema
        schema = SchemaState.schema

        # Extract data
        dump_data = {
            "query": self.query,
            "schema": str(schema),
        }
        response = await query_request(RequestData(**dump_data))
        self.response = response.json(indent=2)


def extract_data_component() -> rx.Component:
    return rx.vstack(
        rx.text_area(
            id="query",
            placeholder="Enter query",
            on_change=StructureQuery.set_query,
            width="100%",
            height="10vh",
        ),
        rx.button(
            "Query",
            color_scheme="tomato",
            on_click=StructureQuery.handle_query,
        ),
        rx.cond(
            StructureQuery.response,
            rx.text_area(
                id="response",
                value=StructureQuery.response,
                size="3",
                resize="vertical",
                width="100%",
                height="70vh",
            ),
            rx.text("", size="sm"),
        ),
        width="100%",
    )

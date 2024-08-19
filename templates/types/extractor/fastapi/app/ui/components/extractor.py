import reflex as rx
from app.services.model import DEFAULT_MODEL
from app.services.extractor import ExtractorService, InvalidModelCode


class StructureQuery(rx.State):
    query: str
    response: str
    loading: bool = False
    code: str = DEFAULT_MODEL
    error: str = None

    @rx.background
    async def handle_query(self):
        async with self:
            if not self.query:
                self.error = "Please enter a query."
                return
            self.error = None
            self.loading = True

        # Extract data
        # Await long operations outside the context to avoid blocking UI
        try:
            response = await ExtractorService.extract(
                query=self.query, model_code=self.code
            )
        except InvalidModelCode:
            async with self:
                self.error = "Invalid Python code"
                response = None

        async with self:
            self.response = response
            self.loading = False


def extract_data_component() -> rx.Component:
    return rx.vstack(
        rx.cond(
            StructureQuery.error,
            rx.callout(
                StructureQuery.error,
                icon="triangle_alert",
                color_scheme="red",
                role="alert",
            ),
        ),
        rx.text_area(
            id="query",
            placeholder="Enter query",
            on_change=StructureQuery.set_query,
            width="100%",
            height="10vh",
        ),
        rx.button(
            "Query",
            on_click=StructureQuery.handle_query,
            loading=StructureQuery.loading,
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
        ),
        width="100%",
    )

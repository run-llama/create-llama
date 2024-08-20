import logging
import reflex as rx
from app.services.model import DEFAULT_MODEL
from app.services.extractor import ExtractorService, InvalidModelCode

logger = logging.getLogger("uvicorn")


class StructuredQuery(rx.State):
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
        except Exception as e:
            import traceback

            logger.error(
                f"Error occurred: {str(e)}\nStack trace:\n{traceback.format_exc()}"
            )
            async with self:
                self.error = f"Error: {str(e)}"
                response = None

        async with self:
            self.response = response
            self.loading = False


def extract_data_component() -> rx.Component:
    return rx.vstack(
        rx.cond(
            StructuredQuery.error,
            rx.callout(
                StructuredQuery.error,
                icon="triangle_alert",
                color_scheme="red",
                role="alert",
            ),
        ),
        rx.text_area(
            id="query",
            placeholder="Enter query",
            on_change=StructuredQuery.set_query,
            width="100%",
            height="10vh",
        ),
        rx.button(
            "Query",
            on_click=StructuredQuery.handle_query,
            loading=StructuredQuery.loading,
        ),
        rx.cond(
            StructuredQuery.response,
            rx.code_block(
                StructuredQuery.response,
                language="json",
                show_line_numbers=True,
                wrap_long_lines=True,
                size="3",
                resize="vertical",
                width="100%",
                height="70vh",
            ),
        ),
        width="100%",
    )

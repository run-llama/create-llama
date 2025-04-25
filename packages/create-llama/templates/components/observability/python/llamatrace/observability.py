import llama_index.core
import os


def init_observability():
    PHOENIX_API_KEY = os.getenv("PHOENIX_API_KEY")
    if not PHOENIX_API_KEY:
        raise ValueError("PHOENIX_API_KEY environment variable is not set")
    os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
    llama_index.core.set_global_handler(
        "arize_phoenix", endpoint="https://llamatrace.com/v1/traces"
    )

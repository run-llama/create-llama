from llama_agents import SimpleMessageQueue
from app.utils import load_from_env

message_queue_host = (
    load_from_env("MESSAGE_QUEUE_HOST", throw_error=False) or "127.0.0.1"
)
message_queue_port = load_from_env("MESSAGE_QUEUE_PORT", throw_error=False) or "8000"

message_queue = SimpleMessageQueue(
    host=message_queue_host,
    port=int(message_queue_port) if message_queue_port else None,
)

import json
from logging import getLogger
from pathlib import Path
from fastapi import FastAPI
from typing import Dict, Optional
from llama_agents import CallableMessageConsumer, QueueMessage
from llama_agents.message_queues.base import BaseMessageQueue
from llama_agents.message_consumers.base import BaseMessageQueueConsumer
from llama_agents.message_consumers.remote import RemoteMessageConsumer
from app.utils import load_from_env
from app.core.message_queue import message_queue


logger = getLogger(__name__)


class TaskResultService:
    def __init__(
        self,
        message_queue: BaseMessageQueue,
        name: str = "human",
        host: str = "127.0.0.1",
        port: Optional[int] = 8002,
    ) -> None:
        self.name = name
        self.host = host
        self.port = port

        self._message_queue = message_queue

        # app
        self._app = FastAPI()
        self._app.add_api_route(
            "/", self.home, methods=["GET"], tags=["Human Consumer"]
        )
        self._app.add_api_route(
            "/process_message",
            self.process_message,
            methods=["POST"],
            tags=["Human Consumer"],
        )

    @property
    def message_queue(self) -> BaseMessageQueue:
        return self._message_queue

    def as_consumer(self, remote: bool = False) -> BaseMessageQueueConsumer:
        if remote:
            return RemoteMessageConsumer(
                url=(
                    f"http://{self.host}:{self.port}/process_message"
                    if self.port
                    else f"http://{self.host}/process_message"
                ),
                message_type=self.name,
            )

        return CallableMessageConsumer(
            message_type=self.name,
            handler=self.process_message,
        )

    async def process_message(self, message: QueueMessage) -> None:
        Path("task_results").mkdir(exist_ok=True)
        with open("task_results/task_results.json", "+a") as f:
            json.dump(message.model_dump(), f)
            f.write("\n")

    async def home(self) -> Dict[str, str]:
        return {"message": "hello, human."}

    async def register_to_message_queue(self) -> None:
        """Register to the message queue."""
        await self.message_queue.register_consumer(self.as_consumer(remote=True))


human_consumer_host = (
    load_from_env("HUMAN_CONSUMER_HOST", throw_error=False) or "127.0.0.1"
)
human_consumer_port = load_from_env("HUMAN_CONSUMER_PORT", throw_error=False) or "8002"


human_consumer_server = TaskResultService(
    message_queue=message_queue,
    host=human_consumer_host,
    port=int(human_consumer_port) if human_consumer_port else None,
    name="human",
)

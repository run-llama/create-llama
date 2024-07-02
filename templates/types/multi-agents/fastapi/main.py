from dotenv import load_dotenv
from app.settings import init_settings

load_dotenv()
init_settings()

from llama_agents import ServerLauncher
from app.core.message_queue import message_queue
from app.core.control_plane import control_plane
from app.core.task_result import human_consumer_server
from app.agents.query_engine.agent import init_query_engine_agent
from app.agents.dummy.agent import init_dummy_agent

agents = [
    init_query_engine_agent(message_queue),
    init_dummy_agent(message_queue),
]

launcher = ServerLauncher(
    agents,
    control_plane,
    message_queue,
    additional_consumers=[human_consumer_server.as_consumer()],
)

if __name__ == "__main__":
    launcher.launch_servers()

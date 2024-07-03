from llama_index.llms.openai import OpenAI
from llama_agents import AgentOrchestrator, ControlPlaneServer
from app.core.message_queue import message_queue
from app.utils import load_from_env


control_plane_host = (
    load_from_env("CONTROL_PLANE_HOST", throw_error=False) or "127.0.0.1"
)
control_plane_port = load_from_env("CONTROL_PLANE_PORT", throw_error=False) or "8001"


# setup control plane
control_plane = ControlPlaneServer(
    message_queue=message_queue,
    orchestrator=AgentOrchestrator(llm=OpenAI()),
    host=control_plane_host,
    port=int(control_plane_port) if control_plane_port else None,
)

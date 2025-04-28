from app.code_workflow import ArtifactWorkflow
from llama_index.core.workflow import Workflow
from llama_index.llms.openai import OpenAI
from llama_index.server.api.models import ChatRequest


def create_workflow(chat_request: ChatRequest) -> Workflow:
    workflow = ArtifactWorkflow(
        llm=OpenAI(model="gpt-4.1"),
        chat_request=chat_request,
        timeout=120.0,
    )
    return workflow

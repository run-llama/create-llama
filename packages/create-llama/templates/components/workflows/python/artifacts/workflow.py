from app.code_workflow import CodeArtifactWorkflow

# from app.document_workflow import DocumentArtifactWorkflow to generate documents
from llama_index.core.workflow import Workflow
from llama_index.llms.openai import OpenAI
from llama_index.server.api.models import ChatRequest


def create_workflow(chat_request: ChatRequest) -> Workflow:
    workflow = CodeArtifactWorkflow(
        llm=OpenAI(model="gpt-4.1"),
        chat_request=chat_request,
        timeout=120.0,
    )
    return workflow

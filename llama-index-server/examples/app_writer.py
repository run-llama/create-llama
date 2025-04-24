from fastapi import FastAPI

from llama_index.core.agent.workflow import AgentWorkflow, FunctionAgent
from llama_index.core.workflow import Workflow
from llama_index.llms.openai import OpenAI
from llama_index.server import LlamaIndexServer, UIConfig
from llama_index.server.api.models import ChatRequest
from llama_index.server.api.utils import get_last_artifact
from llama_index.server.tools.artifact import CodeGenerator, DocumentGenerator


def create_workflow(chat_request: ChatRequest) -> Workflow:
    app_writer_agent = FunctionAgent(
        name="Coder",
        description="A skilled full-stack developer.",
        system_prompt="""
        You are an skilled full-stack developer that can help user update the code by using the code generator tool.
        Follow these instructions:
         + Thinking and provide a correct requirement to the code generator tool. 
         + Always use the tool to update the code.
         + Don't need to response the code just summarize the code and the changes you made.
        """,
        tools=[
            CodeGenerator(
                last_artifact=get_last_artifact(chat_request),
                llm=OpenAI(model="gpt-4.1"),
            ).to_tool()
        ],  # type: ignore
        llm=OpenAI(model="gpt-4.1"),
    )
    doc_writer_agent = FunctionAgent(
        name="Writer",
        description="A skilled document writer.",
        system_prompt="""
        You are an skilled document writer that can help user update the document by using the document generator tool.
        Follow these instructions:
         + Thinking and provide a correct requirement to the document generator tool.
         + Always use the tool to update the document.
         + Don't need to response the document just summarize the document and the changes you made.
        """,
        tools=[
            DocumentGenerator(
                last_artifact=get_last_artifact(chat_request),
                llm=OpenAI(model="gpt-4.1"),
            ).to_tool()
        ],  # type: ignore
        llm=OpenAI(model="gpt-4.1-mini"),
    )
    workflow = AgentWorkflow(
        agents=[app_writer_agent, doc_writer_agent],
        root_agent="Coder",
        verbose=True,
    )
    return workflow


def create_app() -> FastAPI:
    app = LlamaIndexServer(
        workflow_factory=create_workflow,
        ui_config=UIConfig(
            app_title="App Writer",
        ),
    )
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app_writer:app", host="0.0.0.0", port=8000, reload=True)

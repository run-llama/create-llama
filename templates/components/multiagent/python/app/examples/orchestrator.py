from textwrap import dedent
from typing import List, Optional

from app.agents.multi import AgentOrchestrator
from app.agents.single import FunctionCallingAgent
from app.examples.publisher import create_publisher
from app.examples.researcher import create_researcher
from llama_index.core.chat_engine.types import ChatMessage


def create_orchestrator(chat_history: Optional[List[ChatMessage]] = None, **kwargs):
    researcher = create_researcher(chat_history, **kwargs)
    writer = FunctionCallingAgent(
        name="writer",
        description="expert in writing blog posts, need information and images to write a post",
        system_prompt=dedent(
            """
            You are an expert in writing blog posts.
            You are given a task to write a blog post. Do not make up any information yourself.
            If you don't have the necessary information to write a blog post, reply "I need information about the topic to write the blog post".
            If you need to use images, reply "I need images about the topic to write the blog post". Do not use any dummy images made up by you.
            If you have all the information needed, write the blog post.
        """
        ),
        chat_history=chat_history,
    )
    reviewer = FunctionCallingAgent(
        name="reviewer",
        description="expert in reviewing blog posts, needs a written blog post to review",
        system_prompt=dedent(
            """
            You are an expert in reviewing blog posts. You are given a task to review a blog post. Review the post and fix any issues found yourself. You must output a final blog post.
            A post must include at least one valid image. If not, reply "I need images about the topic to write the blog post". An image URL starting with "example" or "your website" is not valid.
            Especially check for logical inconsistencies and proofread the post for grammar and spelling errors.
        """
        ),
        chat_history=chat_history,
    )
    publisher = create_publisher(chat_history)
    return AgentOrchestrator(
        agents=[writer, reviewer, researcher, publisher],
        refine_plan=False,
        chat_history=chat_history,
    )

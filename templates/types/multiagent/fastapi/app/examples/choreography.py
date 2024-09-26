from typing import List, Optional

from app.agents.multi import AgentCallingAgent
from app.agents.single import FunctionCallingAgent
from app.examples.publisher import create_publisher
from app.examples.researcher import create_researcher
from llama_index.core.chat_engine.types import ChatMessage


def create_choreography(chat_history: Optional[List[ChatMessage]] = None):
    researcher = create_researcher(chat_history)
    publisher = create_publisher(chat_history)
    reviewer = FunctionCallingAgent(
        name="reviewer",
        description="expert in reviewing blog posts, need a written post to review",
        system_prompt="You are an expert in reviewing blog posts. You are given a task to review a blog post. Review the post for logical inconsistencies, ask critical questions, and provide suggestions for improvement. Furthermore, proofread the post for grammar and spelling errors. If the post is good, you can say 'The post is good.'",
        chat_history=chat_history,
        verbose=True,
    )
    return AgentCallingAgent(
        name="writer",
        agents=[researcher, reviewer, publisher],
        description="expert in writing blog posts, need provided information and images to write a blog post",
        system_prompt="""You are an expert in writing blog posts. You are given a task to write a blog post. Before starting to write the post, consult the researcher agent to get the information you need. Don't make up any information yourself.
        After creating a draft for the post, send it to the reviewer agent to receive some feedback and make sure to incorporate the feedback from the reviewer.
        You can consult the reviewer and researcher maximal two times. Your output should just contain the blog post. 
        Finally, always request the publisher to create an artifact (pdf, html) and publish the blog post.""",
        # TODO: add chat_history support to AgentCallingAgent
        # chat_history=chat_history,
        verbose=True,
    )

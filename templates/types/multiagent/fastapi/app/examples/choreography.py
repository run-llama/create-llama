from typing import List, Optional
from app.agents.single import FunctionCallingAgent
from app.agents.multi import AgentCallingAgent
from app.examples.researcher import create_researcher
from llama_index.core.chat_engine.types import ChatMessage


def create_choreography(chat_history: Optional[List[ChatMessage]] = None):
    researcher = create_researcher(chat_history)
    reviewer = FunctionCallingAgent(
        name="reviewer",
        role="expert in reviewing blog posts",
        system_prompt="You are an expert in reviewing blog posts. You are given a task to review a blog post. Review the post for logical inconsistencies, ask critical questions, and provide suggestions for improvement. Furthermore, proofread the post for grammar and spelling errors. If the post is good, you can say 'The post is good.'",
        chat_history=chat_history,
    )
    return AgentCallingAgent(
        name="writer",
        agents=[researcher, reviewer],
        role="expert in writing blog posts",
        system_prompt="""You are an expert in writing blog posts. You are given a task to write a blog post. Before starting to write the post, consult the researcher agent to get the information you need. Don't make up any information yourself.
        After creating a draft for the post, send it to the reviewer agent to receive some feedback and make sure to incorporate the feedback from the reviewer.
        You can consult the reviewer and researcher maximal two times. Your output should just contain the blog post.""",
        # TODO: add chat_history support to AgentCallingAgent
        # chat_history=chat_history,
    )

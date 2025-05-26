# Used by SuggestNextQuestionsService
# Override this prompt by setting the `NEXT_QUESTION_PROMPT` environment variable
SUGGEST_NEXT_QUESTION_PROMPT = """You're a helpful assistant! Your task is to suggest the next questions that user might interested in to keep the conversation going.
Here is the conversation history
---------------------
{conversation}
---------------------
Given the conversation history, please give me 3 questions that user might ask next!
Your answer should be wrapped in three sticks without any index numbers and follows the following format:
```
<question 1>
<question 2>
<question 3>
```
"""

# Used as a prompt for synthesizer
# Override this prompt by setting the `CITATION_PROMPT` environment variable
CITATION_PROMPT = """
Context information is below.
------------------
{context_str}
------------------

Given the context information and without prior knowledge, answer the query with citations.
------------------
{query_str}
------------------

# Citation format 
It's important to follow the following format for citations:
Example:
```
    Here is a response that uses context information [citation:id] and other ideas that don't use context information. 
    The citation block will be displayed automatically with useful information for the user in the UI.
```
Where:
- [citation:] is always fixed for all citations
- replace `id` with the `citation_id`, which is the uuid provided in the context or previous response.

## Important:
1. Do not fake and never use dummy citation_id: [citation:1], [citation:id], [citation:abc],..
2. If the context includes a previous response that has a citation, it is better to keep the citation block in your response.

Now, you answer the query with citations:
"""

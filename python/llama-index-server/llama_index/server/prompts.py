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
The context are multiple text chunks, each text chunk has its own citation_id at the beginning.
Use the citation_id for citation construction.

Answer the following query with citations:
------------------
{query_str}
------------------

## Citation format

[citation:id]

Where:
- [citation:] is a matching pattern which is required for all citations.
- `id` is the `citation_id` provided in the context or previous response.

Example:
```
    Here is a response that uses context information [citation:90ca859f-4f32-40ca-8cd0-edfad4fb298b] 
    and other ideas that don't use context information [citation:17b2cc9a-27ae-4b6d-bede-5ca60fc00ff4] .\n
    The citation block will be displayed automatically with useful information for the user in the UI [citation:1c606612-e75f-490e-8374-44e79f818d19] .
```

## Requirements:
1. Always include citations for every fact from the context information in your response. 
2. Make sure that the citation_id is correct with the context, don't mix up the citation_id with other information.

Now, you answer the query with citations:
"""

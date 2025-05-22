# Used by SuggestNextQuestionsService
# Override this prompt by setting the `NEXT_QUESTION_PROMPT` environment variable
SUGGEST_NEXT_QUESTION_PROMPT = """You're a helpful assistant! Your task is to suggest the next questions that user might interested in to keep the conversation going.
Here is the conversation history
---------------------
{conversation}
---------------------
Given the conversation history, please give me 3 questions that user might ask next!
Your answer should be wrapped in three sticks without any index numbers and follows the following format:
\`\`\`
<question 1>
<question 2>
<question 3>
\`\`\`
"""

# Used as a prompt for synthesizer
# Override this prompt by setting the `CITATION_PROMPT` environment variable
CITATION_PROMPT = """
Context information is below.
------------------
{context_str}
------------------

# Citing sources
When making your answer, make sure to cite the sources at the end of each idea, sentence or paragraph.

If `id` is available, add citations in the following format:
[citation:id] 
- where `citation` is always fixed for all citations and `id` is the id provided in the header of the source. 

e.g:
Baby llama is called cria [citation:bf826322-61c4-4443-980c-7462539b04c2] and is a female.

Given the context information and not prior knowledge, answer for the query with citations:
------------------
Query: {query_str}
------------------

Answer:
"""

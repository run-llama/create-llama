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

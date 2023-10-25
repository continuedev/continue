# Hypothetical Document Embeddings (HyDE) - Prompts

from ...core.sdk import ContinueSDK


code_prompt = """\
Generate a hypothetical snippet of code that would be relevant in answering the user's question. 
It can be either a function, a class, or more than one of these. It should be roughly 10-20 lines of code and must be valid {language} code.

User question: {user_input}

Write your code in the block below:
```{language}
"""


async def code_hyde(user_input, language: str, sdk: ContinueSDK):
    prompt = code_prompt.format(user_input=user_input, language=language)
    completion = await sdk.models.summarize.complete(
        prompt, log=False, max_tokens=100, temperature=0.0, stop=["```"]
    )
    return completion

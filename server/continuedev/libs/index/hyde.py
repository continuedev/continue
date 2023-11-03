# Hypothetical Document Embeddings (HyDE) - Prompts

from ..llm.base import LLM


CODE_PROMPT = """\
Generate a hypothetical snippet of code that would be relevant in answering the user's question. 
It can be either a function, a class, or more than one of these. It should be roughly 10-20 lines of code and must be valid {language} code.

User question: {user_input}

Write your code in the block below:
```{language}
"""


async def code_hyde(user_input, language: str, model: LLM):
    prompt = CODE_PROMPT.format(user_input=user_input, language=language)
    completion = await model.complete(
        prompt, log=False, max_tokens=100, temperature=0.0, stop=["```"]
    )
    return completion


KEYWORDS_PROMPT = """\
For each user question, generate keywords or file names that would be useful to search for in the codebase. Don't repeat or include similar keywords more than once. Try to include specific keywords or snippets of code that might exist in a codebase, not just general terms. Separate the keywords with a comma.

User question: Where should I add unit tests for this Python project?
Keywords: import pytest, test, import unittest, pytest-cov, coverage, coverage.py, assert, fixture, pytest.mark.parametrize

User: How to add a new command to this VS Code extension?
Keywords: vscode, command, package.json, vscode.commands.registerCommand

User: How to add a new endpoint to this Spring Boot application?
Keywords: spring, boot, endpoint, controller, request mapping, mapping, requestbody, requestparam, pathvariable, req

User question: {user_input}
Keywords: 
"""


async def generate_keywords(user_input, model: LLM):
    completion = await model.complete(
        KEYWORDS_PROMPT.format(user_input=user_input),
        log=False,
        max_tokens=80,
        temperature=0.0,
        stop=["\n"],
    )
    return completion.strip().replace("'", "").replace('"', "").split(", ")

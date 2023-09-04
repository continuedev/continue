from textwrap import dedent
from typing import Coroutine, Union

from ...core.main import Step
from ...core.observation import Observation
from ...core.sdk import ContinueSDK
from ...libs.chroma.query import ChromaIndexManager
from .core.core import EditFileStep


class CreateCodebaseIndexChroma(Step):
    name: str = "Create Codebase Index"
    hide: bool = True

    async def describe(self, llm) -> Coroutine[str, None, None]:
        return "Indexing the codebase..."

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        index = ChromaIndexManager(await sdk.ide.getWorkspaceDirectory())
        if not index.check_index_exists():
            self.hide = False
        index.create_codebase_index()


class AnswerQuestionChroma(Step):
    question: str
    _answer: Union[str, None] = None
    name: str = "Answer Question"

    async def describe(self, llm) -> Coroutine[str, None, None]:
        if self._answer is None:
            return f"Answering the question: {self.question}"
        else:
            return self._answer

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        index = ChromaIndexManager(await sdk.ide.getWorkspaceDirectory())
        results = index.query_codebase_index(self.question)

        code_snippets = ""

        files = []
        for node in results.source_nodes:
            resource_name = list(node.node.relationships.values())[0]
            filepath = resource_name[: resource_name.index("::")]
            files.append(filepath)
            code_snippets += f"""{filepath}```\n{node.node.text}\n```\n\n"""

        prompt = dedent(
            f"""Here are a few snippets of code that might be useful in answering the question:

            {code_snippets}

            Here is the question to answer:

            {self.question}

            Here is the answer:"""
        )

        answer = await sdk.models.medium.complete(prompt)
        # Make paths relative to the workspace directory
        answer = answer.replace(await sdk.ide.getWorkspaceDirectory(), "")

        self._answer = answer

        await sdk.ide.setFileOpen(files[0])


class EditFileChroma(Step):
    request: str
    hide: bool = True

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        index = ChromaIndexManager(await sdk.ide.getWorkspaceDirectory())
        results = index.query_codebase_index(self.request)

        resource_name = list(results.source_nodes[0].node.relationships.values())[0]
        filepath = resource_name[: resource_name.index("::")]

        await sdk.run_step(
            EditFileStep(
                filepath=filepath,
                prompt=f"Here is the code:\n\n{{code}}\n\nHere is the user request:\n\n{self.request}\n\nHere is the code after making the requested changes:\n",
            )
        )

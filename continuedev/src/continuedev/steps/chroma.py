from textwrap import dedent
from typing import Coroutine, Union
from ..core.observation import Observation, TextObservation
from ..core.main import Step, ContinueSDK
from .core.core import EditFileStep
from ..libs.chroma.query import query_codebase_index
from .core.core import EditFileStep


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
        results = query_codebase_index(self.question)

        code_snippets = ""

        files = []
        for node in results.source_nodes:
            resource_name = list(node.node.relationships.values())[0]
            filepath = resource_name[:resource_name.index("::")]
            files.append(filepath)
            code_snippets += f"""{filepath}```\n{node.node.text}\n```\n\n"""

        prompt = dedent(f"""Here are a few snippets of code that might be useful in answering the question:

            {code_snippets}

            Here is the question to answer:

            {self.question}

            Here is the answer:""")

        answer = (await sdk.models.gpt35()).complete(prompt)
        print(answer)
        self._answer = answer

        await sdk.ide.setFileOpen(files[0])


class EditFileChroma(Step):
    request: str
    hide: bool = True

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        results = query_codebase_index(self.request)

        resource_name = list(
            results.source_nodes[0].node.relationships.values())[0]
        filepath = resource_name[:resource_name.index("::")]

        await sdk.run_step(EditFileStep(filepath=filepath, prompt=f"Here is the code:\n\n{{code}}\n\nHere is the user request:\n\n{self.request}\n\nHere is the code after making the requested changes:\n"))

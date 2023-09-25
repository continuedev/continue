import asyncio
import os
from typing import Coroutine, Dict, List, Union

from ...core.main import ContextItem, ContextItemDescription, ContextItemId, Step
from ...core.observation import Observation
from ...core.sdk import ContinueSDK
from ...libs.chroma.query import ChromaIndexManager
from ..context_providers.util import remove_meilisearch_disallowed_chars
from .chat import SimpleChatStep
from .core.core import EditFileStep


class CreateCodebaseIndexChroma(Step):
    name: str = "Create Codebase Index"
    hide: bool = True
    description: str = "Generating codebase embeddings..."

    async def describe(self, models) -> Coroutine[str, None, None]:
        return "Generated codebase embeddings"

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        index = ChromaIndexManager(sdk.ide.workspace_directory)
        if not index.check_index_exists():
            self.hide = False

        await index.create_codebase_index(sdk)


async def rerank_chroma_results(
    results: Dict[str, str], user_input: str, n: int, sdk: ContinueSDK
):
    """
    Reranks the results from the codebase index based on the user input
    """

    results_prompt = "\n\n".join(
        map(
            lambda kv: f"{kv[0]}\n```\n{kv[1][:500 if len(kv[1]) > 2000 else -1]}\n```",
            results.items(),
        )
    )
    include_prompt = f"""\
You will be asked to select the most relevant results from a list. You should choose the results that will be most useful in answering the user's request. For each result that you think is important, you should simply say its title on a new line. Here is an example input:
\"\"\"
add.py
```
def add(a, b):
    return a + b
```
            
multiply.py
```
def multiply(a, b):
    return a * b
```

subtract.py
```
def subtract(a, b):
    return a - b
```
\"\"\"
And here is the output you would give if you thought that add.py and subtract.py were the most relevant results:
\"\"\"
add.py
subtract.py
\"\"\"
            
Now for the real task, here are the top {len(results)} results from the codebase for the user request, "{user_input}":

{results_prompt}

Here are the {n} most relevant results listed in the same format from the example:"""

    remove_prompt = f"""\
You will be asked to select items from a list that are irrelevant to the given request. For each result that is unrelated, you should simply say its title on a new line. Here is an example input:
\"\"\"
add.py
```
def add(a, b):
    return a + b
```
            
multiply.py
```
def multiply(a, b):
    return a * b
```

subtract.py
```
def subtract(a, b):
    return a - b
```
\"\"\"
And here is the output you would give if you thought that add.py and subtract.py were not useful to answer the given request:
\"\"\"
add.py
subtract.py
\"\"\"
            
Now for the real task, here are the top {len(results)} results from the codebase for the user request, "{user_input}":

{results_prompt}

List the results that are not useful in answering the request, using in the same format from the example. Only choose those that are completely unrelated, and no more than {n // 2}:"""

    include = sdk.models.summarize.complete(include_prompt)
    remove = sdk.models.summarize.complete(remove_prompt)
    include_completion, remove_completion = await asyncio.gather(include, remove)

    results = {
        key: value for key, value in results.items() if key not in remove_completion
    }
    selected = {
        key: value for key, value in results.items() if key in include_completion
    }

    for key in selected:
        del results[key]

    additional = n - len(selected)
    for i in range(additional):
        if len(results) == 0:
            break

        # Get an item from the results
        key = list(results.keys())[0]
        selected[key] = results[key]
        del results[key]

    return selected


def shorten_filepaths(filepaths: List[str]) -> List[str]:
    """
    Shortens the filepaths to just the filename,
    unless directory names are needed for uniqueness
    """
    basenames = set(map(os.path.basename, filepaths))
    if len(basenames) == len(filepaths):
        return list(basenames)

    basename_counts = {}
    for filepath in filepaths:
        basename = os.path.basename(filepath)
        if basename not in basename_counts:
            basename_counts[basename] = 0
        basename_counts[basename] += 1

    for i in range(0, len(filepaths)):
        basename = os.path.basename(filepaths[i])
        if basename_counts[basename] <= 1:
            filepaths[i] = basename
        else:
            filepaths[i] = os.path.join(
                os.path.basename(os.path.dirname(filepaths[i])), basename
            )

    return filepaths


class AnswerQuestionChroma(Step):
    user_input: str
    _answer: Union[str, None] = None
    name: str = "Answer Question"

    m: int = 20
    n: int = 10

    hide: bool = True

    async def describe(self, llm) -> Coroutine[str, None, None]:
        if self._answer is None:
            return f"Answering the question: {self.user_input}"
        else:
            return self._answer

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        index = ChromaIndexManager(sdk.ide.workspace_directory)
        self.description = f"Reading from {self.m} files..."
        await sdk.update_ui()
        results = index.query_codebase_index(self.user_input, n=self.m)

        shortened_filepaths = shorten_filepaths(results["ids"][0])
        results_dict = {
            filename: document
            for filename, document in zip(shortened_filepaths, results["documents"][0])
            if document.strip() != ""
        }

        results_dict = await rerank_chroma_results(
            results_dict, self.user_input, self.n, sdk
        )

        for filename, document in results_dict.items():
            filepath = results["ids"][0][shortened_filepaths.index(filename)]
            await sdk.add_context_item(
                ContextItem(
                    content=document,
                    description=ContextItemDescription(
                        name=filename,
                        description=filepath,
                        id=ContextItemId(
                            provider_title="file",
                            item_id=remove_meilisearch_disallowed_chars(filepath),
                        ),
                    ),
                )
            )

        await sdk.update_ui()
        await sdk.run_step(SimpleChatStep(name="Answer Question"))


class EditFileChroma(Step):
    user_input: str
    hide: bool = True

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        index = ChromaIndexManager(sdk.ide.workspace_directory)
        results = index.query_codebase_index(self.user_input)

        resource_name = list(results.source_nodes[0].node.relationships.values())[0]
        filepath = resource_name[: resource_name.index("::")]

        await sdk.run_step(
            EditFileStep(
                filepath=filepath,
                prompt=f"Here is the code:\n\n{{code}}\n\nHere is the user request:\n\n{self.user_input}\n\nHere is the code after making the requested changes:\n",
            )
        )

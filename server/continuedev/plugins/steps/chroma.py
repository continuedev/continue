import asyncio
import os
from typing import Coroutine, Dict, List, Optional, Union

from pydantic import Field

from ...core.main import ContextItem, ContextItemDescription, ContextItemId, Step
from ...core.observation import Observation
from ...core.sdk import ContinueSDK
from ...core.steps import EditFileStep, UserInputStep
from ...libs.chroma.query import ChromaIndexManager
from ..context_providers.util import remove_meilisearch_disallowed_chars
from .chat import SimpleChatStep
from ...core.steps import EditFileStep


class CreateCodebaseIndexChroma(Step):
    name: str = "Create Codebase Index"
    hide: bool = True
    description: str = "Generating codebase embeddings..."
    openai_api_key: Optional[str] = None

    ignore_files: List[str] = Field(
        [],
        description="Files to ignore when indexing the codebase. You can use glob patterns, such as **/*.py. This is useful for directories that contain generated code, or other directories that are not relevant to the codebase.",
    )

    async def describe(self, models) -> Coroutine[str, None, None]:
        return "Generated codebase embeddings."

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        index = ChromaIndexManager(
            sdk.ide.workspace_directory,
            openai_api_key=self.openai_api_key,
        )
        if not index.check_index_exists():
            self.hide = False

        await index.create_codebase_index(sdk, ignore_files=self.ignore_files)


async def rerank_chroma_results_group(
    results: Dict[str, str], user_input: str, n: int, sdk: ContinueSDK
):
    """
    Reranks the results from the codebase index based on the user input
    """
    results_prompt = "\n\n".join(
        map(
            lambda kv: f"{kv[0]}\n```\n{kv[1][:500]}\n```",
            results.items(),
        )
    )
    include_prompt = f"""\
You will be asked to select the most relevant results from a list. You should choose the results that will be most useful in answering the user's request. For each result that you think is important, you should simply say its title on a new line. Here is an example input:
\"\"\"
add.py::0
```
def add(a, b):
    return a + b
```
            
multiply.py::0
```
def multiply(a, b):
    return a * b
```

subtract.py::0
```
def subtract(a, b):
    return a - b
```
\"\"\"
And here is the output you would give if you thought that add.py and subtract.py were the most relevant results:
\"\"\"
add.py::0
subtract.py::0
\"\"\"
            
Now for the real task, here are the top {len(results)} results from the codebase for the user request, "{user_input}":

{results_prompt}

Here are the {n} most relevant results listed in the same format from the example:"""

    remove_prompt = f"""\
You will be asked to select items from a list that are irrelevant to the given request. For each result that is unrelated, you should simply say its title on a new line. Here is an example input:
\"\"\"
add.py::0
```
def add(a, b):
    return a + b
```
            
multiply.py::0
```
def multiply(a, b):
    return a * b
```

subtract.py::0
```
def subtract(a, b):
    return a - b
```
\"\"\"
And here is the output you would give if you thought that add.py and subtract.py were not useful to answer the given request:
\"\"\"
add.py::0
subtract.py::0
\"\"\"
            
Now for the real task, here are the top {len(results)} results from the codebase for the user request, "{user_input}":

{results_prompt}

List the results that are not useful in answering the request, using in the same format from the example. Only choose those that are completely unrelated, and no more than {n // 2}:"""

    include = sdk.models.summarize.complete(include_prompt, log=False)
    remove = sdk.models.summarize.complete(remove_prompt, log=False)
    include_completion, remove_completion = await asyncio.gather(include, remove)

    return include_completion.split("\n"), remove_completion.split("\n")


async def rerank_chroma_results(
    results: Dict[str, str], user_input: str, n: int, sdk: ContinueSDK
):
    """
    Reranks the results from the codebase index based on the user input
    """
    # Split the results into groups
    groups = []
    group = {}
    keys = list(results.keys())
    for i in range(len(keys)):
        if len(group) == 10:
            groups.append(group)
            group = {}
        group[keys[i]] = results[keys[i]]

    if len(group) > 0:
        groups.append(group)

    # Gather the include/remove results from each group
    include = set([])
    remove = set([])

    tasks = []
    for group in groups:
        tasks.append(rerank_chroma_results_group(group, user_input, n, sdk))

    reranking_results = await asyncio.gather(*tasks)
    for rr in reranking_results:
        include.update(rr[0])
        remove.update(rr[1])

    # Use these results to whittle down the results
    counts_per_files = {}
    for id in results:
        filename = id.split("::")[0]
        if filename not in counts_per_files:
            counts_per_files[filename] = 0
        counts_per_files[filename] += 1

    repeated_files = set(filter(lambda x: counts_per_files[x] > 1, counts_per_files))

    selected = {
        key: value
        for key, value in results.items()
        if key not in remove or key.split("::")[0] in repeated_files
    }
    selected = {key: value for key, value in selected.items() if key in include}

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

    if additional < 0:
        # We need to remove some items
        additional = -additional
        for i in range(additional):
            if len(selected) == 0:
                break

            # Get an item from the results
            key = list(selected.keys())[0]
            del selected[key]

    return selected


def shorten_filepaths(filepaths: List[str]) -> List[str]:
    """
    Shortens the filepaths to just the filename,
    unless directory names are needed for uniqueness
    """
    basenames = list(map(os.path.basename, filepaths))
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

    n_retrieve: Optional[int] = Field(
        20, description="Number of results to initially retrieve from vector database"
    )
    n_final: Optional[int] = Field(
        10, description="Final number of results to use after re-ranking"
    )

    use_reranking: bool = Field(
        True,
        description="Whether to use re-ranking, which will allow initial selection of n_retrieve results, then will use an LLM to select the top n_final results",
    )

    hide: bool = True

    async def describe(self, llm) -> Coroutine[str, None, None]:
        if self._answer is None:
            return f"Answering the question: {self.user_input}"
        else:
            return self._answer

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        index = ChromaIndexManager(sdk.ide.workspace_directory)
        self.description = f"Reading from {self.n_retrieve} files..."
        await sdk.update_ui()
        results = index.query_codebase_index(
            self.user_input, n=self.n_retrieve if self.use_reranking else self.n_final
        )

        shortened_filepaths = shorten_filepaths(results["ids"][0])
        results_dict = {
            filename: document
            for filename, document in zip(shortened_filepaths, results["documents"][0])
            if document.strip() != ""
        }

        if self.use_reranking:
            results_dict = await rerank_chroma_results(
                results_dict, self.user_input, self.n_final, sdk
            )

        filepaths = set([])
        context_items: List[ContextItem] = []
        for id, document in results_dict.items():
            filename = id.split("::")[0]
            filepath = results["ids"][0][shortened_filepaths.index(id)].split("::")[0]
            if filepath in filepaths:
                continue
            
            ctx_item = ContextItem(
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
            context_items.append(ctx_item)
            await sdk.add_context_item(ctx_item)
            filepaths.add(filepath)

        await sdk.update_ui()
        await sdk.run_step(SimpleChatStep(name="Answer Question", description=f"Reading from {self.n_final} files..."))

        # for ctx_item in context_items:
        #     await sdk.delete_context_item(ctx_item.description.id)


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

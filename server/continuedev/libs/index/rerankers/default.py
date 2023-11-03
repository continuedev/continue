import asyncio
import os
from typing import Dict, List

from ...llm.base import LLM
from ..chunkers.chunk import Chunk


async def decide_include_remove(
    chunks: List[Chunk], user_input: str, n: int, model: LLM
) -> Dict[str, str]:
    """
    Reranks the results from the codebase index based on the user input.

    Returns a tuple of (include, remove) where both are lists of chunk ids
    """
    # TODO: Go back to using disambiguated names instead of just basename
    results_prompt = "\n\n".join(
        map(
            lambda chunk: f"{os.path.basename(chunk.id)}\n```\n{chunk.content[:500]}\n```",
            chunks,
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
            
Now for the real task, here are the top {len(chunks)} results from the codebase for the user request, "{user_input}":

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
            
Now for the real task, here are the top {len(chunks)} results from the codebase for the user request, "{user_input}":

{results_prompt}

List the results that are not useful in answering the request, using in the same format from the example. Only choose those that are completely unrelated, and no more than {n // 2}:"""

    include = model.complete(include_prompt, log=False)
    remove = model.complete(remove_prompt, log=False)
    include_completion, remove_completion = await asyncio.gather(include, remove)

    return include_completion.split("\n"), remove_completion.split("\n")


async def default_reranker_parallel(
    chunks: List[Chunk], user_input: str, n: int, model: LLM, group_size: int = 10
) -> List[Chunk]:
    """
    A reranker, given a mapping from id to contents, returns the subset of the mapping that is most relevant to the user_input
    """
    # Split the results into groups of max size 10
    groups = []
    group = []
    for chunk in chunks:
        group.append(chunk)
        if len(group) == group_size:
            groups.append(group)
            group = []

    if len(group) > 0:
        groups.append(group)

    # Gather the ids of chunks that should be removed and included
    include = set([])
    remove = set([])

    tasks = []
    for group in groups:
        tasks.append(decide_include_remove(group, user_input, n, model))

    reranking_results = await asyncio.gather(*tasks)
    for rr in reranking_results:
        include.update(rr[0])
        remove.update(rr[1])

    # Determine which documents were repeated, these are probably important
    counts_per_document = {}
    for chunk in chunks:
        if chunk.document_id not in counts_per_document:
            counts_per_document[chunk.document_id] = 0
        counts_per_document[chunk.document_id] += 1

    repeated_documents = set(
        filter(lambda x: counts_per_document[x] > 1, counts_per_document)
    )

    not_disqualified = set(
        [
            chunk.id
            for chunk in chunks
            if chunk.id not in remove or chunk.document_id in repeated_documents
        ]
    )

    included = set([id for id in not_disqualified if chunk.id in include])

    additional = n - len(included)
    for i in range(additional):
        if len(not_disqualified) == 0:
            break

        # Get an item from not_disqualified
        included.add(not_disqualified.pop())

    if additional < 0:
        # We need to remove some items
        additional = -additional
        for i in range(additional):
            if len(included) == 0:
                break

            # Remove one
            included.pop()

    return [chunk for chunk in chunks if chunk.id in included]

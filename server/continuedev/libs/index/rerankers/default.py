import asyncio
from typing import Dict

from continuedev.core.sdk import ContinueSDK


async def decide_include_remove(
    results: Dict[str, str], user_input: str, n: int, sdk: ContinueSDK
) -> Dict[str, str]:
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


async def default_reranker_parallel(
    results: Dict[str, str], user_input: str, n: int, sdk: ContinueSDK
) -> Dict[str, str]:
    """
    A reranker, given a mapping from id to contents, returns the subset of the mapping that is most relevant to the user_input
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
        tasks.append(decide_include_remove(group, user_input, n, sdk))

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

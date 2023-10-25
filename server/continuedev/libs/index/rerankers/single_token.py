import asyncio
from typing import List
from ....core.sdk import ContinueSDK
from ..chunkers.chunk import Chunk
from ...util.logging import logger

prompt = """
You are an expert software developer responsible for helping detect whether the retrieved snippet of code is relevant to the query. For a given input, you need to output a single token: "Yes" or "No" indicating the retrieved snippet is relevant to the query.

Query: {query}
Snippet:
```{document_id}
{document}
```
Relevant:
"""


async def single_token_reranker(
    chunk: Chunk, user_input: str, sdk: ContinueSDK
) -> float:
    compiled_prompt = prompt.format(query=user_input, document=chunk.content)
    completion = await sdk.models.summarize.complete(
        compiled_prompt, log=False, max_tokens=1, temperature=0.0
    )
    l = completion.strip().lower()
    if l == "yes":
        return 1.0
    elif l == "no":
        return 0.0
    else:
        logger.warning(f"Unexpected response from single token reranker: {l}")
        return 0.0


async def single_token_reranker_parallel(
    chunks: List[Chunk], user_input: str, n: int, sdk: ContinueSDK
) -> List[Chunk]:
    tasks = [single_token_reranker(chunk, user_input, sdk) for chunk in chunks]
    results = await asyncio.gather(*tasks)
    return [chunk for chunk, result in zip(chunks, results) if result]

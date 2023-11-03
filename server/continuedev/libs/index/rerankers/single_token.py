import asyncio
from typing import List
from ...llm.base import LLM

import openai
from ..chunkers.chunk import Chunk
from ...util.logging import logger

PROMPT = """
You are an expert software developer responsible for helping detect whether the retrieved snippet of code is relevant to the query. For a given input, you need to output a single word: "Yes" or "No" indicating the retrieved snippet is relevant to the query.

Query: Where is the FastAPI server?
Snippet:
```/Users/andrew/Desktop/server/main.py
from fastapi import FastAPI
app = FastAPI()
@app.get("/")
def read_root():
    return {{"Hello": "World"}}
```
Relevant: Yes

Query: Where in the documentation does it talk about the UI?
Snippet:
```/Users/andrew/Projects/bubble_sort/src/lib.rs
fn bubble_sort<T: Ord>(arr: &mut [T]) {{
    for i in 0..arr.len() {{
        for j in 1..arr.len() - i {{
            if arr[j - 1] > arr[j] {{
                arr.swap(j - 1, j);
            }}
        }}
    }}
}}
```
Relevant: No

Query: {query}
Snippet:
```{document_id}
{document}
```
Relevant: 
"""


async def single_token_reranker(chunk: Chunk, user_input: str, model: LLM) -> float:
    compiled_prompt = PROMPT.format(
        query=user_input, document=chunk.content, document_id=chunk.document_id
    )

    if False:
        # TODO: Continuous ranking with logits
        # openai.api_key = openai_api_key
        response = openai.Completion.create(
            model="gpt-3.5-turbo",
            prompt=compiled_prompt,
            max_tokens=1,
            temperature=0.0,
            stop=["```"],
            logit_bias={3363: 1, 1400: 1},
            logprobs=1,
        )
        return response["choices"][0]["logprobs"]["token_logprobs"][0]
    else:
        try:
            completion = await model.complete(
                compiled_prompt, log=False, max_tokens=1, temperature=0.0
            )
        except Exception:
            return 0.5

        answer = completion.strip().lower().replace('"', "").replace("'", "")
        if answer == "yes":
            return 1.0
        elif answer == "no":
            return 0.0
        else:
            logger.warning(f"Unexpected response from single token reranker: {answer}")
            return 0.0


async def single_token_reranker_parallel(
    chunks: List[Chunk], user_input: str, n: int, model: LLM
) -> List[Chunk]:
    tasks = [single_token_reranker(chunk, user_input, model) for chunk in chunks]
    results = await asyncio.gather(*tasks)

    # Sort by results, return top n
    sorted_chunks = sorted(zip(chunks, results), key=lambda x: x[1], reverse=True)
    return [chunk for chunk, _ in sorted_chunks[:n]]

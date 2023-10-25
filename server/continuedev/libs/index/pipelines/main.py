from typing import List, Optional

from ..rerankers.default import default_reranker_parallel
from ..indices.meilisearch_index import MeilisearchCodebaseIndex
from ....core.sdk import ContinueSDK
from ..indices.chroma_index import ChromaCodebaseIndex
from ..chunkers.chunk import Chunk


async def main_retrieval_pipeline(
    query: str,
    sdk: ContinueSDK,
    openai_api_key: Optional[str] = None,
    n_retrieve: int = 50,
    use_reranking: bool = True,
    n_final: int = 10,
    rerank_group_size: int = 5,
) -> List[Chunk]:
    chroma_index = ChromaCodebaseIndex(
        sdk.ide.workspace_directory, openai_api_key=openai_api_key
    )
    meilisearch_index = MeilisearchCodebaseIndex(sdk.ide.workspace_directory)

    print(f"Scanning {n_retrieve} files...")

    # Get top chunks from index
    to_retrieve_from_each = (n_retrieve if use_reranking else n_final) // 2
    chroma_chunks = await chroma_index.query(query, n=to_retrieve_from_each)
    meilisearch_chunks = await meilisearch_index.query(query, n=to_retrieve_from_each)

    # De-duplicate
    chunk_ids = set()
    chunks = []
    for chunk in chroma_chunks + meilisearch_chunks:
        if chunk.id not in chunk_ids:
            chunk_ids.add(chunk.id)
            chunks.append(chunk)

    # Rerank to select top results
    if use_reranking:
        print(f"Selecting most important files...")
        chunks = await default_reranker_parallel(
            chunks,
            query,
            n_final,
            sdk,
            group_size=rerank_group_size,
        )

    return chunks

import asyncio
from functools import cached_property
from meilisearch_python_async import Client
from meilisearch_python_async.errors import MeilisearchApiError
from meilisearch_python_async.index import Index
from ....server.meilisearch_server import get_meilisearch_url
from .base import CodebaseIndex
from ..chunkers import Chunk
from typing import Any, AsyncGenerator, Dict, List

from ....server.meilisearch_server import remove_meilisearch_disallowed_chars
from ...util.logging import logger


class MeilisearchCodebaseIndex(CodebaseIndex):
    directory: str

    def __init__(self, directory: str):
        self.directory = directory

    @cached_property
    def index_name(self) -> str:
        return remove_meilisearch_disallowed_chars(self.directory)

    async def exists(self) -> bool:
        """Returns whether the index exists (has been built)"""
        async with Client(get_meilisearch_url()) as search_client:
            try:
                index = await search_client.get_index(self.index_name)
                return index is not None
            except MeilisearchApiError as e:
                return False
            except Exception as e:
                logger.warning(f"Error while checking if meilisearch index exists: {e}")
                return False

    def chunk_to_meilisearch_document(self, chunk: Chunk, index: int) -> Dict[str, Any]:
        return {
            "id": str(index),
            "content": chunk.content,
            "document_id": chunk.document_id,
            **chunk.other_metadata,
            "metadata": {
                "start_line": chunk.start_line,
                "end_line": chunk.end_line,
                "index": chunk.index,
            },
        }

    def meilisearch_document_to_chunk(self, document: Dict[str, Any]) -> Chunk:
        other_metadata = document.copy()
        del other_metadata["content"]
        del other_metadata["metadata"]
        del other_metadata["document_id"]
        del other_metadata["id"]

        return Chunk(
            content=document["content"],
            start_line=document["metadata"]["start_line"],
            end_line=document["metadata"]["end_line"],
            index=document["metadata"]["index"],
            document_id=document["document_id"],
            other_metadata=other_metadata,
        )

    async def add_chunks(self, chunks: List[Chunk], index: Index, offset: int):
        await index.add_documents(
            [
                self.chunk_to_meilisearch_document(chunk, j + offset)
                for j, chunk in enumerate(chunks)
            ]
        )

    async def build(self, chunks: AsyncGenerator[Chunk, None]):
        """Builds the index, yielding progress as a float between 0 and 1"""
        async with Client(get_meilisearch_url()) as search_client:
            try:
                await search_client.create_index(self.index_name)
                index = await search_client.get_index(self.index_name)
                # await index.update_ranking_rules(
                #     ["attribute", "words", "typo", "proximity", "sort", "exactness"]
                # )
                await index.update_searchable_attributes(["content", "document_id"])

                i = 0
                GROUP_SIZE = 100
                group = []
                async for chunk in chunks:
                    if len(group) < GROUP_SIZE:
                        group.append(chunk)
                        continue

                    await self.add_chunks(
                        group,
                        index,
                        i,
                    )

                    i += GROUP_SIZE
                    group = []
                    await asyncio.sleep(0.1)

                if len(group) > 0:
                    await self.add_chunks(group, index, i)

            except Exception as e:
                logger.warning(f"Error while building meilisearch index: {e}")

    async def update(self) -> AsyncGenerator[float, None]:
        """Updates the index, yielding progress as a float between 0 and 1"""
        raise NotImplementedError()

    async def _query(self, query: str, n: int = 4) -> List[Chunk]:
        async with Client(get_meilisearch_url()) as search_client:
            try:
                results = await search_client.index(self.index_name).search(
                    query, limit=n
                )

                return [
                    self.meilisearch_document_to_chunk(result)
                    for result in results.hits
                ]

            except Exception as e:
                logger.warning(f"Error while retrieving document from meilisearch: {e}")

            return []

    async def query(self, query: str, n: int = 4) -> List[Chunk]:
        """Queries the index, returning the top n results"""
        return await self._query(query, n=n)

    async def query_keywords(self, keywords: List[str], n: int = 4) -> List[Chunk]:
        count_per_chunk = {}
        id_to_chunk = {}
        for keyword in keywords:
            chunks = await self._query(keyword, n=n)
            for chunk in chunks:
                if chunk.id not in count_per_chunk:
                    count_per_chunk[chunk.id] = 0
                    id_to_chunk[chunk.id] = chunk
                count_per_chunk[chunk.id] += 1

        # Sort by count
        sorted_chunks = sorted(
            count_per_chunk.items(), key=lambda item: item[1], reverse=True
        )

        # Get top n
        chunks = []
        for chunk_id, count in sorted_chunks[:n]:
            chunks.append(id_to_chunk[chunk_id])

        return chunks

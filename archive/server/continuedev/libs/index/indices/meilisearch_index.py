import asyncio
from functools import cached_property
from typing import Any, AsyncGenerator, Dict, List, Tuple, Union

from meilisearch_python_async import Client
from meilisearch_python_async.index import Index

from ....server.meilisearch_server import (
    get_meilisearch_url,
    remove_meilisearch_disallowed_chars,
)
from ...util.logging import logger
from ..chunkers import Chunk
from ..chunkers.chunk_directory import IndexAction
from .base import CodebaseIndex


class MeilisearchCodebaseIndex(CodebaseIndex):
    """
    The documents have the following structure:
    - document_id field is the hash of the document
    - actual id is document_id + :: + chunk index
    - tags is a list of each (directory + branch) the chunk is indexed for, then we can query for all chunks with a given label

    There is only a single index because it allows us to share between sub-directories
    """

    tag: str

    def __init__(self, tag: str):
        self.tag = tag

    @cached_property
    def index_name(self) -> str:
        return remove_meilisearch_disallowed_chars("continue_codebase_index")

    def chunk_to_meilisearch_document(
        self, chunk: Chunk, index: int, tags: List[str]
    ) -> Dict[str, Any]:
        return {
            "id": str(index),
            "content": chunk.content,
            "document_id": chunk.digest,
            "tags": [],
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
        del other_metadata["tags"]
        del other_metadata["filepath"]

        return Chunk(
            content=document["content"],
            start_line=document["metadata"]["start_line"],
            end_line=document["metadata"]["end_line"],
            index=document["metadata"]["index"],
            digest=document["document_id"],
            filepath=document["filepath"],
            other_metadata=other_metadata,
        )

    async def add_chunks(self, chunks: List[Chunk], index: Index, offset: int):
        await index.add_documents(
            [
                self.chunk_to_meilisearch_document(
                    chunk, int(chunk.digest, 16), [self.tag]
                )
                for chunk in chunks
            ]
        )

    async def delete_chunks(self, document_ids: List[str], index: Index):
        documents = (
            await index.get_documents(
                filter=f'document_id IN [{",".join(document_ids)}]'
            )
        ).results

        ids = [document["id"] for document in documents]
        await index.delete_documents(ids)

    async def get_docs_for_digest(self, digest: str, index: Index):
        """Given the hash of a document, give all of the ids of the chunks stored in the index"""
        return await index.get_documents(filter=f'document_id="{digest}"')

    async def remove_label(self, digest: str, label: str, index: Index):
        documents = (await self.get_docs_for_digest(digest, index)).results
        for document in documents:
            document["tags"].remove(label)

        await index.update_documents(documents)

    async def add_label(self, digest: str, label: str, index: Index):
        documents = (await self.get_docs_for_digest(digest, index)).results
        for document in documents:
            document["tags"].append(label)

        await index.update_documents(documents)

    async def build(
        self, chunks: AsyncGenerator[Tuple[IndexAction, Union[str, Chunk]], None]
    ):
        """Builds the index, yielding progress as a float between 0 and 1"""
        async with Client(get_meilisearch_url()) as search_client:
            try:
                await search_client.create_index(self.index_name)
                index = await search_client.get_index(self.index_name)
                # await index.update_ranking_rules(
                #     ["attribute", "words", "typo", "proximity", "sort", "exactness"]
                # )
                await index.update_searchable_attributes(["content", "document_id"])
                await index.update_filterable_attributes(["tags", "document_id"])

                i = 0
                GROUP_SIZE = 100
                group = []
                async for action, chunk in chunks:
                    if action == "compute":
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
                    elif action == "delete":
                        await self.delete_chunks([chunk], index)
                    elif action == "add_label":
                        await self.add_label(chunk, self.tag, index)
                    elif action == "remove_label":
                        await self.remove_label(chunk, self.tag, index)

                if len(group) > 0:
                    await self.add_chunks(group, index, i)

            except Exception as e:
                logger.warning(f"Error while building meilisearch index: {e}")

    async def _query(self, query: str, n: int = 4) -> List[Chunk]:
        async with Client(get_meilisearch_url()) as search_client:
            try:
                results = await search_client.index(self.index_name).search(
                    query, limit=n, filter=f'tags IN ["{self.tag}"]'
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

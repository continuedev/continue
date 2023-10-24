import asyncio
from functools import cached_property
from meilisearch_python_async import Client
from ....server.meilisearch_server import get_meilisearch_url
from .base import CodebaseIndex
from ..chunkers import Chunk
from typing import Any, AsyncGenerator, Dict, List, Optional

from ....core.sdk import ContinueSDK
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
            except Exception as e:
                logger.warning(f"Error while checking if meilisearch index exists: {e}")
                return False

    def chunk_to_meilisearch_document(self, chunk: Chunk, index: int) -> Dict[str, Any]:
        return {
            "id": index,
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

    async def build(
        self,
        sdk: ContinueSDK,
        ignore_files: List[str] = [],
        chunks: Optional[List[Chunk]] = None,
    ) -> AsyncGenerator[float, None]:
        """Builds the index, yielding progress as a float between 0 and 1"""
        if chunks is None:
            logger.warning("Meilisearch index requires chunks to be passed in")
            yield 1

        async with Client(get_meilisearch_url()) as search_client:
            try:
                await search_client.create_index(self.index_name)
                index = await search_client.get_index(self.index_name)

                i = 0
                GROUP_SIZE = 100
                while i < len(chunks):
                    await index.add_documents(
                        [
                            self.chunk_to_meilisearch_document(chunk, i)
                            for i, chunk in enumerate(chunks[i : i + GROUP_SIZE])
                        ]
                    )

                    i += GROUP_SIZE
                    yield i / len(chunks)
                    await asyncio.sleep(0.1)

            except Exception as e:
                logger.warning(f"Error while building meilisearch index: {e}")

        yield 1

    async def update(self) -> AsyncGenerator[float, None]:
        """Updates the index, yielding progress as a float between 0 and 1"""
        raise NotImplementedError()

    async def query(self, query: str, n: int = 4) -> List[Chunk]:
        """Queries the index, returning the top n results"""
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

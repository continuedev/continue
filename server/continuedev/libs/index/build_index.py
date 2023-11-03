from typing import AsyncGenerator
from ...core.config import ContinueConfig
from ...server.protocols.ide_protocol import AbstractIdeProtocolServer
from ...libs.index.chunkers.chunk_directory import chunk_directory
from ...libs.index.indices.meilisearch_index import MeilisearchCodebaseIndex
from ...libs.index.indices.chroma_index import MAX_CHUNK_SIZE, ChromaCodebaseIndex


async def build_index(
    ide: AbstractIdeProtocolServer, config: ContinueConfig
) -> AsyncGenerator[float, None]:
    settings = config.retrieval_settings
    chroma_index = ChromaCodebaseIndex(
        ide.workspace_directory,
        openai_api_key=settings.openai_api_key,
        api_base=settings.api_base,
        api_type=settings.api_type,
        api_version=settings.api_version,
        organization_id=settings.organization_id,
    )
    meilisearch_index = MeilisearchCodebaseIndex(ide.workspace_directory)

    indices_to_build = 0
    chroma_exists = await chroma_index.exists()
    # meilisearch_exists = await meilisearch_index.exists()
    meilisearch_exists = chroma_exists
    if not chroma_exists:
        indices_to_build += 1
    if not meilisearch_exists:
        indices_to_build += 1

    if indices_to_build == 0:
        yield 1
        return

    chunks = await chunk_directory(ide, MAX_CHUNK_SIZE)

    total_progress = 0
    if not chroma_exists:
        async for progress in chroma_index.build(
            ide, ignore_files=settings.ignore_files, chunks=chunks
        ):
            yield progress / indices_to_build

        total_progress += 50

    if not meilisearch_exists:
        async for progress in meilisearch_index.build(
            ide, ignore_files=settings.ignore_files, chunks=chunks
        ):
            yield progress / indices_to_build + total_progress / 100

import asyncio
from typing import AsyncGenerator

from ...core.config import ContinueConfig
from ...libs.index.indices.chroma_index import MAX_CHUNK_SIZE, ChromaCodebaseIndex
from ...libs.index.indices.meilisearch_index import MeilisearchCodebaseIndex
from ...server.protocols.ide_protocol import AbstractIdeProtocolServer
from .chunkers.chunk_directory import (
    local_stream_chunk_directory,
    stream_chunk_directory,
)


async def build_index(
    ide: AbstractIdeProtocolServer, config: ContinueConfig
) -> AsyncGenerator[float, None]:
    tag = await ide.getTag()
    branch = await ide.getBranch()
    settings = config.retrieval_settings
    chroma_index = ChromaCodebaseIndex(
        tag,
        openai_api_key=settings.openai_api_key,
        api_base=settings.api_base,
        api_type=settings.api_type,
        api_version=settings.api_version,
        organization_id=settings.organization_id,
    )
    meilisearch_index = MeilisearchCodebaseIndex(tag)

    n = 2
    done = False
    buffers = [[] for _ in range(n)]

    async def generator_for_chroma():
        nonlocal buffers
        while not done or len(buffers[0]) > 0:
            if len(buffers[0]) > 0:
                yield buffers[0].pop(0)
            else:
                await asyncio.sleep(0.1)

    async def generator_for_meilisearch():
        nonlocal buffers
        while not done or len(buffers[1]) > 0:
            if len(buffers[1]) > 0:
                yield buffers[1].pop(0)
            else:
                await asyncio.sleep(0.1)

    chroma_task = asyncio.create_task(chroma_index.build(generator_for_chroma()))
    meilisearch_task = asyncio.create_task(
        meilisearch_index.build(generator_for_meilisearch())
    )

    server_url = ide.window_info.ide_info.get("server_url", "http://localhost:65432")
    if ide.window_info.ide_info.get("remote_name", None) in ["ssh-remote", "wsl"] or (
        "localhost" not in server_url and "127.0.0.1" not in server_url
    ):
        # Use the old method if workspace is remote OR if Continue server is not running on the same machine as the IDE
        async for chunk, progress in stream_chunk_directory(ide, MAX_CHUNK_SIZE):
            if chunk is not None:
                buffers[0].append(("compute", chunk))
                buffers[1].append(("compute", chunk))
            yield progress

    else:
        # If on same machine, can access files directly
        for action, chunk, progress in local_stream_chunk_directory(
            ide.workspace_directory, MAX_CHUNK_SIZE, branch
        ):
            buffers[0].append((action, chunk))
            buffers[1].append((action, chunk))
            yield progress

    done = True
    while not chroma_task.done() or not meilisearch_task.done():
        await asyncio.sleep(0.1)

    yield 1

import asyncio
import os
from typing import AsyncGenerator, Callable, Generator, List, Optional, Tuple

from .ignore import should_ignore_file_factory

from ....server.protocols.ide_protocol import AbstractIdeProtocolServer

from .chunk import Chunk
from . import chunk_document
from .fast_index import stream_files_to_update


MAX_SIZE_IN_CHARS = 50_000


async def get_file_contents(filepath: str, ide: AbstractIdeProtocolServer) -> str:
    try:
        return (await ide.readFile(filepath))[:MAX_SIZE_IN_CHARS]
    except Exception as _:
        return None


async def get_contents_of_files(
    files: List[str], ide: AbstractIdeProtocolServer, ignore_files: List[str] = []
) -> List[str]:
    # Get file contents for all at once
    return await asyncio.gather(*[ide.readFile(file) for file in files])


async def get_all_filepaths(
    ide: AbstractIdeProtocolServer, ignore_files: List[str] = []
) -> Tuple[List[str], Callable[[str], bool]]:
    files = await ide.listDirectoryContents(ide.workspace_directory, True)

    # Get all .gitignores first
    gitignore_paths = list(
        filter(
            lambda file: file.endswith(".gitignore")
            or file.endswith(".continueignore"),
            files,
        )
    )
    gitignore_contents = await get_contents_of_files(gitignore_paths, ide)
    gitignores = {
        path: content for path, content in zip(gitignore_paths, gitignore_contents)
    }

    should_ignore_file = should_ignore_file_factory(ignore_files, gitignores)

    return files, should_ignore_file


async def stream_file_contents(
    ide: AbstractIdeProtocolServer, ignore_files: List[str] = [], group_size: int = 100
) -> AsyncGenerator[Tuple[str, Optional[str], float], None]:
    # Get list of filenames to index
    # TODO: Don't get all at once, walk the tree, or break up
    files, should_ignore = await get_all_filepaths(ide, ignore_files)

    # Don't want to flood with too many requests
    i = 0
    total = len(files)
    for file in files:
        if should_ignore(file):
            total = max(1, total - 1)
            yield (file, None, i / total)
            continue

        contents = await get_file_contents(file, ide)
        yield (file, contents, i / total)
        i += 1


async def stream_chunk_directory(
    ide: AbstractIdeProtocolServer, max_chunk_size: int
) -> AsyncGenerator[Tuple[Optional[Chunk], float], None]:
    async for file, contents, progress in stream_file_contents(ide):
        if contents is None:
            yield (None, progress)
            continue
        for chunk in chunk_document(file, contents, max_chunk_size):
            yield (chunk, progress)


def local_stream_chunk_directory(
    workspace_dir: str,
    max_chunk_size: int,
) -> Generator[Tuple[Optional[Chunk], float], None, None]:
    for filepath in stream_files_to_update(workspace_dir):
        # Ignore if the file is too large (cutoff is 10MB)
        if os.path.getsize(filepath) > 10_000_000:
            continue

        try:
            contents = open(filepath, "r").read()
        except Exception as e:
            print(e, filepath)
            continue

        if contents.strip() == "":
            continue

        # TODO: How to estimate progress, or is stream_files_to_update fast
        # enough to do all at once?
        for chunk in chunk_document(filepath, contents, max_chunk_size):
            yield (chunk, 0.0)

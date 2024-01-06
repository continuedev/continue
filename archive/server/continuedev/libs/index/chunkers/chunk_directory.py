import asyncio
import hashlib
import os
from typing import (
    AsyncGenerator,
    Callable,
    Generator,
    List,
    Literal,
    Optional,
    Tuple,
    Union,
)

from continuedev.continuedev import sync_results

from ....server.protocols.ide_protocol import AbstractIdeProtocolServer
from . import chunk_document
from .chunk import Chunk
from .ignore import should_ignore_file_factory

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
    ide: AbstractIdeProtocolServer, max_chunk_size: int, ignore_files: List[str] = []
) -> AsyncGenerator[Tuple[Optional[Chunk], float], None]:
    async for file, contents, progress in stream_file_contents(
        ide, ignore_files=ignore_files
    ):
        if contents is None:
            yield (None, progress)
            continue

        for chunk in chunk_document(
            file, contents, max_chunk_size, hashlib.sha1(contents.encode()).hexdigest()
        ):
            yield (chunk, progress)


IndexAction = Literal["compute", "delete", "add_label", "remove_label"]


def local_stream_chunk_directory(
    workspace_dir: str, max_chunk_size: int, branch: str
) -> Generator[Tuple[IndexAction, Union[str, Chunk], float], None, None]:
    """Stream Tuples of (action, chunk, progress). the chunk is a Chunk if 'compute' action, otherwise it is the digest string. the assumption in this case is to delete/update all chunks for the document id (digest)."""
    (compute, delete, add_label, remove_label) = sync_results(workspace_dir, branch)

    progress = 1
    total = len(compute) + len(delete) + len(add_label) + len(remove_label) + 1

    for filepath, digest in compute:
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

        for chunk in chunk_document(filepath, contents, max_chunk_size, digest):
            yield ("compute", chunk, progress / total)

        progress += 1

    for filepath, digest in delete:
        yield ("delete", digest, progress / total)
        progress += 1

    for filepath, digest in add_label:
        yield ("add_label", digest, progress / total)
        progress += 1

    for filepath, digest in remove_label:
        yield ("remove_label", digest, progress / total)
        progress += 1

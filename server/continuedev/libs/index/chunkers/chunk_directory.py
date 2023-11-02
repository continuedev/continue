import asyncio
import os
from typing import Dict, List

from ....server.protocols.ide_protocol import AbstractIdeProtocolServer
from ...util.filter_files import DEFAULT_IGNORE_PATTERNS, should_filter_path
from .chunk import Chunk
from . import chunk_document


FILE_IGNORE_PATTERNS = [
    # File Names
    "**/.DS_Store",
    "**/package-lock.json",
    "**/yarn.lock",
    # File Types
    "*.log",
    "*.ttf",
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.gif",
    "*.mp4",
    "*.svg",
    "*.ico",
    "*.pdf",
    "*.zip",
    "*.gz",
    "*.tar",
    "*.tgz",
    "*.rar",
    "*.7z",
    "*.exe",
    "*.dll",
    "*.obj",
    "*.o",
    "*.a",
    "*.lib",
    "*.so",
    "*.dylib",
    "*.ncb",
    "*.sdf",
]

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


def gi_basename(path: str) -> str:
    return path[: path.index(".gitignore")]


async def get_all_file_contents(
    ide: AbstractIdeProtocolServer, ignore_files: List[str] = [], group_size: int = 100
) -> Dict[str, str]:
    # Get list of filenames to index
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

    def gitignore_patterns_for_file(filepath: str) -> List[str]:
        paths = list(
            filter(
                lambda gitignore_path: filepath.startswith(gi_basename(gitignore_path)),
                gitignore_paths,
            )
        )
        patterns = []
        for path in paths:
            base = gi_basename(path)
            for pattern in gitignores[path].split("\n"):
                if pattern.strip() != "":
                    patterns.append(os.path.join(base, pattern.strip()))

        return patterns

    # Filter from ignore_directories
    files = list(
        filter(
            lambda file: not should_filter_path(
                file,
                ignore_files
                + DEFAULT_IGNORE_PATTERNS
                + FILE_IGNORE_PATTERNS
                + gitignore_patterns_for_file(file),
            ),
            files,
        )
    )

    items = []
    i = 0
    # Don't want to flood with too many requests
    while i < len(files):
        items += await get_contents_of_files(files[i : i + group_size], ide)

        i += group_size
        await asyncio.sleep(0.1)

    return dict(filter(lambda tup: tup[1] is not None, zip(files, items)))


async def chunk_directory(
    ide: AbstractIdeProtocolServer, max_chunk_size: int
) -> List[Chunk]:
    file_contents = await get_all_file_contents(ide)

    chunks = []
    for filepath, contents in file_contents.items():
        chunks += chunk_document(filepath, contents, max_chunk_size)

    return chunks

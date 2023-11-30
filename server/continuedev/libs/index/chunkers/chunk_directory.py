import asyncio
import os
from typing import AsyncGenerator, Callable, List, Optional, Tuple

from ....server.protocols.ide_protocol import AbstractIdeProtocolServer
from ...util.filter_files import DEFAULT_IGNORE_PATTERNS, should_filter_path
from . import chunk_document
from .chunk import Chunk

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
    "*.woff",
    "*.woff2",
    "*.eot",
    "*.cur",
    "*.avi",
    "*.mpg",
    "*.mpeg",
    "*.mov",
    "*.mp3",
    "*.mp4",
    "*.mkv",
    "*.mkv",
    "*.webm",
    "*.jar",
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
    if ".gitignore" in path:
        return path[: path.index(".gitignore")]
    elif ".continueignore" in path:
        return path[: path.index(".continueignore")]
    else:
        return path


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

    def should_ignore_file(filepath: str) -> bool:
        return should_filter_path(
            filepath,
            ignore_files
            + DEFAULT_IGNORE_PATTERNS
            + FILE_IGNORE_PATTERNS
            + gitignore_patterns_for_file(filepath),
        )

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
        for chunk in chunk_document(file, contents, max_chunk_size):
            yield (chunk, progress)

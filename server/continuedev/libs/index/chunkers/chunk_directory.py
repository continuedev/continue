import asyncio
from typing import Dict, List, Optional

from ...util.filter_files import DEFAULT_IGNORE_PATTERNS, should_filter_path

from .chunk import Chunk
from . import chunk_document
from ....core.sdk import ContinueSDK

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


async def get_file_contents(filepath: str, sdk: ContinueSDK) -> str:
    try:
        return (await sdk.ide.readFile(filepath))[:MAX_SIZE_IN_CHARS]
    except Exception as _:
        return None


async def get_contents_of_files(
    files: List[str], sdk: ContinueSDK, ignore_files: List[str] = []
) -> List[str]:
    # Get file contents for all at once
    tasks = []

    async def readFile(filepath: str) -> Optional[str]:
        timeout = 0.1
        while True:
            try:
                return await get_file_contents(filepath, sdk)
            except Exception as e:
                if timeout > 4:
                    return None
                await asyncio.sleep(timeout)
                timeout *= 2

    for file in files:
        tasks.append(readFile(file))

    return await asyncio.gather(*tasks)


async def get_all_file_contents(
    sdk: ContinueSDK, ignore_files: List[str] = [], group_size: int = 100
) -> Dict[str, str]:
    # Get list of filenames to index
    files = await sdk.ide.listDirectoryContents(sdk.ide.workspace_directory, True)

    # Filter from ignore_directories
    files = list(
        filter(
            lambda file: not should_filter_path(
                file,
                ignore_files + DEFAULT_IGNORE_PATTERNS + FILE_IGNORE_PATTERNS,
            ),
            files,
        )
    )

    items = []
    i = 0
    # Don't want to flood with too many requests
    while i < len(files):
        items += await get_contents_of_files(files[i : i + group_size], sdk)

        i += group_size
        await asyncio.sleep(0.1)

    return dict(filter(lambda tup: tup[1] is not None, zip(files, items)))


async def chunk_directory(sdk: ContinueSDK, max_chunk_size: int) -> List[Chunk]:
    file_contents = await get_all_file_contents(sdk)

    chunks = []
    for filepath, contents in file_contents.items():
        chunks += chunk_document(filepath, contents, max_chunk_size)

    return chunks

from typing import List, Optional

from .basic import basic_chunker
from .chunk import Chunk, ChunkWithoutID
from .code import code_chunker, file_extension_to_language


def _chunk_document_without_id(
    filepath: str, contents: Optional[str], max_chunk_size: int
) -> List[ChunkWithoutID]:
    """Chunk a document into smaller pieces."""
    if contents is None:
        return []

    ext = filepath.split(".")[-1]
    if ext in file_extension_to_language:
        return code_chunker(filepath, contents, max_chunk_size)

    return basic_chunker(contents, max_chunk_size)


def chunk_document(
    filepath: str, contents: Optional[str], max_chunk_size: int, digest: str
) -> List[Chunk]:
    chunks = _chunk_document_without_id(filepath, contents, max_chunk_size)
    return [chunk.with_id(digest, i, filepath) for i, chunk in enumerate(chunks)]

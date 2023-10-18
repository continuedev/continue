from typing import List, Optional
from .basic import basic_chunker
from .code import code_chunker, file_extension_to_language


def chunk_document(
    filepath: str, contents: Optional[str], max_chunk_size: int
) -> List[str]:
    """Chunk a document into smaller pieces."""
    if contents is None:
        return []

    ext = filepath.split(".")[-1]
    if ext in file_extension_to_language:
        return code_chunker(filepath, contents, max_chunk_size)

    return basic_chunker(contents, max_chunk_size)

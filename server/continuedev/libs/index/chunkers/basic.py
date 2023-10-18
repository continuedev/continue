from typing import List
from ...util.count_tokens import count_tokens


def basic_chunker(contents: str, max_chunk_size: int) -> List[str]:
    """Chunk a document into smaller pieces."""
    chunks = []
    chunk = ""
    chunk_tokens = 0
    for line in contents.split("\n"):
        line_tokens = count_tokens(line)
        if chunk_tokens + line_tokens > max_chunk_size:
            chunks.append(chunk)
            chunk = ""
            chunk_tokens = 0
        chunk += line + "\n"
        chunk_tokens += line_tokens
    chunks.append(chunk)
    return chunks

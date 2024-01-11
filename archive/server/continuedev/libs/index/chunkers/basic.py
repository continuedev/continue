from typing import List

from .chunk import ChunkWithoutID
from ...util.count_tokens import count_tokens


def basic_chunker(contents: str, max_chunk_size: int) -> List[ChunkWithoutID]:
    """Chunk a document into smaller pieces."""
    chunks = []

    chunk_content = ""
    chunk_tokens = 0
    start_line = 0
    curr_line = 0

    for line in contents.split("\n"):
        line_tokens = count_tokens(line)
        if chunk_tokens + line_tokens > max_chunk_size:
            chunks.append(
                ChunkWithoutID(
                    content=chunk_content,
                    start_line=start_line,
                    end_line=curr_line - 1,
                )
            )
            chunk_content = ""
            chunk_tokens = 0
            start_line = curr_line

        chunk_content += line + "\n"
        chunk_tokens += line_tokens
        curr_line += 1

    chunks.append(
        ChunkWithoutID(
            content=chunk_content,
            start_line=start_line,
            end_line=curr_line - 1,
            index=len(chunks),
        )
    )
    return chunks

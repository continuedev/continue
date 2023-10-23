import os
from typing import Dict


def chunk_metadata(filepath: str, chunk: str) -> Dict[str, str]:
    # TODO: Try adding c-tags to the top of each chunk
    return {}


def format_chunk_with_metadata(filepath: str, chunk: str) -> str:
    return f"```title={os.path.basename(filepath)}\n{chunk}```"

from typing import List, Tuple

def sync_results(
    dir: str, branch: str
) -> Tuple[
    List[Tuple[str, str]],
    List[Tuple[str, str]],
    List[Tuple[str, str]],
    List[Tuple[str, str]],
]:
    """Returns lists of files that need (compute, delete, add label, remove label) with each item being a (path, hash) tuple"""
    ...

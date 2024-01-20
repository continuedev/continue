
def sync_results(
    dir: str, branch: str,
) -> tuple[
    list[tuple[str, str]],
    list[tuple[str, str]],
    list[tuple[str, str]],
    list[tuple[str, str]],
]:
    """Returns lists of files that need (compute, delete, add label, remove label) with each item being a (path, hash) tuple."""
    ...

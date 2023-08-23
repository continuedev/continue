from pathlib import Path


def map_path(path: str, orig_root: str, copy_root: str) -> Path:
    path = Path(path)
    if path.is_relative_to(orig_root):
        if path.is_absolute():
            return Path(copy_root) / path.relative_to(orig_root)
        else:
            return path
    else:
        if path.is_absolute():
            return path
        else:
            # For this one, you need to know the directory from which the relative path is being used.
            return Path(orig_root) / path

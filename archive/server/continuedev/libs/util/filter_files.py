# import fnmatch
from typing import List

import pathspec

DEFAULT_IGNORE_DIRS = [
    ".git",
    ".vscode",
    ".idea",
    ".vs",
    ".venv",
    "env",
    ".env",
    "node_modules",
    "dist",
    "build",
    "target",
    "out",
    "bin",
    ".pytest_cache",
    ".vscode-test",
    ".continue",
    "__pycache__",
]

DEFAULT_IGNORE_PATTERNS = DEFAULT_IGNORE_DIRS + list(
    filter(lambda d: f"**/{d}", DEFAULT_IGNORE_DIRS)
)


def should_filter_path(
    path: str, ignore_patterns: List[str] = DEFAULT_IGNORE_PATTERNS
) -> bool:
    """Returns whether a file should be filtered"""
    spec = pathspec.PathSpec.from_lines(
        pathspec.patterns.gitwildmatch.GitWildMatchPattern, ignore_patterns
    )
    return spec.match_file(path)
    # return any(fnmatch.fnmatch(path, pattern) for pattern in ignore_patterns)

import os
from typing import Callable, Dict, List
from ...util.filter_files import DEFAULT_IGNORE_PATTERNS, should_filter_path

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
    "*.woff",
    "*.woff2",
    "*.eot",
    "*.cur",
    "*.avi",
    "*.mpg",
    "*.mpeg",
    "*.mov",
    "*.mp3",
    "*.mp4",
    "*.mkv",
    "*.mkv",
    "*.webm",
    "*.jar",
]


def gi_basename(path: str) -> str:
    if ".gitignore" in path:
        return path[: path.index(".gitignore")]
    elif ".continueignore" in path:
        return path[: path.index(".continueignore")]
    else:
        return path


def local_find_gitignores(workspace_dir: str) -> Dict[str, str]:
    gitignores = {}
    for root, dirs, files in os.walk(workspace_dir):
        for file in files:
            if file.endswith(".gitignore") or file.endswith(".continueignore"):
                path = os.path.join(root, file)
                with open(path, "r") as f:
                    gitignores[path] = f.read()

    return gitignores


def should_ignore_file_factory(
    ignore_files: List[str], gitignores: Dict[str, str]
) -> Callable[[str], bool]:
    gitignore_paths = list(gitignores.keys())

    def gitignore_patterns_for_file(filepath: str) -> List[str]:
        paths = list(
            filter(
                lambda gitignore_path: filepath.startswith(gi_basename(gitignore_path)),
                gitignore_paths,
            )
        )
        patterns = []
        for path in paths:
            base = gi_basename(path)
            for pattern in gitignores[path].split("\n"):
                if pattern.strip() != "":
                    patterns.append(os.path.join(base, pattern.strip()))

        return patterns

    def should_ignore_file(filepath: str) -> bool:
        return should_filter_path(
            filepath,
            ignore_files
            + DEFAULT_IGNORE_PATTERNS
            + FILE_IGNORE_PATTERNS
            + gitignore_patterns_for_file(filepath),
        )

    return should_ignore_file

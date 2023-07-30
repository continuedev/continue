import os
import re
from typing import List
from ...core.main import ContextItem, ContextItemDescription, ContextItemId
from ...core.context import ContextProvider
from .util import remove_meilisearch_disallowed_chars
from fnmatch import fnmatch


MAX_SIZE_IN_BYTES = 1024 * 1024 * 1


def get_file_contents(filepath: str) -> str:
    try:
        filesize = os.path.getsize(filepath)
        if filesize > MAX_SIZE_IN_BYTES:
            return None

        with open(filepath, "r") as f:
            return f.read()
    except Exception as e:
        # Some files cannot be read, e.g. binary files
        return None


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
    "__pycache__"
]


class FileContextProvider(ContextProvider):
    """
    The FileContextProvider is a ContextProvider that allows you to search files in the open workspace.
    """

    title = "file"
    workspace_dir: str
    ignore_patterns: List[str] = DEFAULT_IGNORE_DIRS + \
        list(filter(lambda d: f"**/{d}", DEFAULT_IGNORE_DIRS))

    async def provide_context_items(self) -> List[ContextItem]:
        filepaths = []
        for root, dir_names, file_names in os.walk(self.workspace_dir):
            dir_names[:] = [d for d in dir_names if not any(
                fnmatch(d, pattern) for pattern in self.ignore_patterns)]
            for file_name in file_names:
                filepaths.append(os.path.join(root, file_name))

                if len(filepaths) > 1000:
                    break

            if len(filepaths) > 1000:
                break

        items = []
        for file in filepaths:
            content = get_file_contents(file)
            if content is None:
                continue  # no pun intended

            items.append(ContextItem(
                content=content[:min(2000, len(content))],
                description=ContextItemDescription(
                    name=os.path.basename(file),
                    description=file,
                    id=ContextItemId(
                        provider_title=self.title,
                        item_id=remove_meilisearch_disallowed_chars(file)
                    )
                )
            ))
        return items

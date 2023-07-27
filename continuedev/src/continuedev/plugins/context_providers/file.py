import os
import re
from typing import List
from ...core.main import ContextItem, ContextItemDescription, ContextItemId
from ...core.context import ContextProvider
from fnmatch import fnmatch


def get_file_contents(filepath: str) -> str:
    try:
        with open(filepath, "r") as f:
            return f.read()
    except Exception as e:
        print("Error reading file contents", e)
        return ""


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

        return [ContextItem(
            content=get_file_contents(file)[:min(
                2000, len(get_file_contents(file)))],
            description=ContextItemDescription(
                name=os.path.basename(file),
                description=file,
                id=ContextItemId(
                    provider_title=self.title,
                    item_id=re.sub(r'[^0-9a-zA-Z_-]', '', file)
                )
            )
        ) for file in filepaths]

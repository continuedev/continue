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
    except UnicodeDecodeError:
        return ""


class FileContextProvider(ContextProvider):
    """
    The FileContextProvider is a ContextProvider that allows you to search files in the open workspace.
    """

    title = "file"
    workspace_dir: str
    ignore_patterns: List[str] = list(map(lambda folder: f"**/{folder}", [
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
    ]))

    async def provide_context_items(self) -> List[ContextItem]:
        filepaths = []
        for root, dir_names, file_names in os.walk(self.workspace_dir):
            dir_names[:] = [d for d in dir_names if not any(
                fnmatch(d, pattern) for pattern in self.ignore_patterns)]
            for file_name in file_names:
                filepaths.append(os.path.join(root, file_name))

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

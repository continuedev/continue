import os
from fnmatch import fnmatch
from typing import List

from ...core.context import ContextProvider
from ...core.main import ContextItem, ContextItemDescription, ContextItemId
from .util import remove_meilisearch_disallowed_chars

MAX_SIZE_IN_BYTES = 1024 * 1024 * 1


def get_file_contents(filepath: str) -> str:
    try:
        filesize = os.path.getsize(filepath)
        if filesize > MAX_SIZE_IN_BYTES:
            return None

        with open(filepath, "r") as f:
            return f.read()
    except Exception:
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
    "__pycache__",
]


class FileContextProvider(ContextProvider):
    """
    The FileContextProvider is a ContextProvider that allows you to search files in the open workspace.
    """

    title = "file"
    ignore_patterns: List[str] = DEFAULT_IGNORE_DIRS + list(
        filter(lambda d: f"**/{d}", DEFAULT_IGNORE_DIRS)
    )

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        absolute_filepaths: List[str] = []
        for root, dir_names, file_names in os.walk(workspace_dir):
            dir_names[:] = [
                d
                for d in dir_names
                if not any(fnmatch(d, pattern) for pattern in self.ignore_patterns)
            ]
            for file_name in file_names:
                absolute_filepaths.append(os.path.join(root, file_name))

                if len(absolute_filepaths) > 1000:
                    break

            if len(absolute_filepaths) > 1000:
                break

        items = []
        for absolute_filepath in absolute_filepaths:
            content = get_file_contents(absolute_filepath)
            if content is None:
                continue  # no pun intended

            relative_to_workspace = os.path.relpath(absolute_filepath, workspace_dir)

            items.append(
                ContextItem(
                    content=content[: min(2000, len(content))],
                    description=ContextItemDescription(
                        name=os.path.basename(absolute_filepath),
                        # We should add the full path to the ContextItem
                        # It warrants a data modeling discussion and has no immediate use case
                        description=relative_to_workspace,
                        id=ContextItemId(
                            provider_title=self.title,
                            item_id=remove_meilisearch_disallowed_chars(
                                absolute_filepath
                            ),
                        ),
                    ),
                )
            )
        return items

from typing import List

from pydantic import BaseModel, Field

from ...core.context import ContextProvider
from ...core.main import ContextItem, ContextItemDescription, ContextItemId


class Directory(BaseModel):
    name: str
    files: List[str]
    directories: List["Directory"]


def format_file_tree(tree: Directory, indentation: str = "") -> str:
    result = ""
    for file in tree.files:
        result += f"{indentation}{file}\n"

    for directory in tree.directories:
        result += f"{indentation}{directory.name}/\n"
        result += format_file_tree(directory, indentation + "  ")

    return result


def split_path(path: str, with_root=None) -> List[str]:
    parts = path.split("/") if "/" in path else path.split("\\")
    if with_root is not None:
        root_parts = split_path(with_root)
        parts = parts[len(root_parts) - 1 :]

    return parts


class FileTreeContextProvider(ContextProvider):
    """Type '@tree' to reference the contents of your current workspace. The LLM will be able to see the nested directory structure of your project."""

    title = "tree"
    display_title = "File Tree"
    description = "Add a formatted file tree of this directory to the context"
    dynamic = True

    workspace_dir: str = Field(None, description="The workspace directory to display")

    async def _get_file_tree(self, directory: str) -> str:
        contents = await self.ide.listDirectoryContents(directory, recursive=True)

        tree = Directory(
            name=split_path(self.workspace_dir)[-1], files=[], directories=[]
        )

        for file in contents:
            parts = split_path(file, with_root=self.workspace_dir)

            current_tree = tree
            for part in parts[:-1]:
                if part not in [d.name for d in current_tree.directories]:
                    current_tree.directories.append(
                        Directory(name=part, files=[], directories=[])
                    )

                current_tree = [d for d in current_tree.directories if d.name == part][
                    0
                ]

            current_tree.files.append(parts[-1])

        return format_file_tree(tree)

    async def _filetree_context_item(self):
        return ContextItem(
            content=await self._get_file_tree(self.workspace_dir),
            description=ContextItemDescription(
                name="File Tree",
                description="Add a formatted file tree of this directory to the context",
                id=ContextItemId(provider_title=self.title, item_id=self.title),
            ),
        )

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        self.workspace_dir = workspace_dir
        return [await self._filetree_context_item()]

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        if not id.provider_title == self.title:
            raise Exception("Invalid provider title for item")

        return await self._filetree_context_item()

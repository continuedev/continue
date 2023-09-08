import asyncio
import os
from typing import List

from ...core.context import ContextProvider
from ...core.main import ContextItem, ContextItemDescription, ContextItemId
from ...core.sdk import ContinueSDK
from ...libs.util.filter_files import DEFAULT_IGNORE_PATTERNS
from .util import remove_meilisearch_disallowed_chars

MAX_SIZE_IN_CHARS = 50_000


async def get_file_contents(filepath: str, sdk: ContinueSDK) -> str:
    try:
        return (await sdk.ide.readFile(filepath))[:MAX_SIZE_IN_CHARS]
    except Exception as e:
        print(f"Failed to read file: {e}")
        return None


class FileContextProvider(ContextProvider):
    """
    The FileContextProvider is a ContextProvider that allows you to search files in the open workspace.
    """

    title = "file"
    ignore_patterns: List[str] = DEFAULT_IGNORE_PATTERNS

    display_title = "Files"
    description = "Reference files in the current workspace"
    dynamic = False

    async def start(self, *args):
        await super().start(*args)

        async def on_file_saved(filepath: str, contents: str):
            item = await self.get_context_item_for_filepath(filepath)
            if item is None:
                return
            await self.update_documents([item], self.sdk.ide.workspace_directory)

        async def on_files_created(filepaths: List[str]):
            items = await asyncio.gather(
                *[
                    self.get_context_item_for_filepath(filepath)
                    for filepath in filepaths
                ]
            )
            items = [item for item in items if item is not None]
            await self.update_documents(items, self.sdk.ide.workspace_directory)

        async def on_files_deleted(filepaths: List[str]):
            ids = [self.get_id_for_filepath(filepath) for filepath in filepaths]

            await self.delete_documents(ids)

        async def on_files_renamed(old_filepaths: List[str], new_filepaths: List[str]):
            if self.sdk.ide.workspace_directory is None:
                return

            old_ids = [self.get_id_for_filepath(filepath) for filepath in old_filepaths]
            new_docs = await asyncio.gather(
                *[
                    self.get_context_item_for_filepath(filepath)
                    for filepath in new_filepaths
                ]
            )
            new_docs = [doc for doc in new_docs if doc is not None]

            await self.delete_documents(old_ids)
            await self.update_documents(new_docs, self.sdk.ide.workspace_directory)

        self.sdk.ide.subscribeToFileSaved(on_file_saved)
        self.sdk.ide.subscribeToFilesCreated(on_files_created)
        self.sdk.ide.subscribeToFilesDeleted(on_files_deleted)
        self.sdk.ide.subscribeToFilesRenamed(on_files_renamed)

    def get_id_for_filepath(self, absolute_filepath: str) -> str:
        return remove_meilisearch_disallowed_chars(absolute_filepath)

    async def get_context_item_for_filepath(
        self, absolute_filepath: str
    ) -> ContextItem:
        content = await get_file_contents(absolute_filepath, self.sdk)
        if content is None:
            return None

        relative_to_workspace = os.path.relpath(
            absolute_filepath, self.sdk.ide.workspace_directory
        )

        return ContextItem(
            content=content[: min(2000, len(content))],
            description=ContextItemDescription(
                name=os.path.basename(absolute_filepath),
                # We should add the full path to the ContextItem
                # It warrants a data modeling discussion and has no immediate use case
                description=relative_to_workspace,
                id=ContextItemId(
                    provider_title=self.title,
                    item_id=self.get_id_for_filepath(absolute_filepath),
                ),
            ),
        )

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        contents = await self.sdk.ide.listDirectoryContents(workspace_dir, True)
        if contents is None:
            return []

        absolute_filepaths: List[str] = []
        for filepath in contents[:1000]:
            absolute_filepaths.append(filepath)

        items = await asyncio.gather(
            *[
                self.get_context_item_for_filepath(filepath)
                for filepath in absolute_filepaths
            ]
        )
        items = list(filter(lambda item: item is not None, items))

        return items

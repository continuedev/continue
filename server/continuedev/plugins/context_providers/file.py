import asyncio
import os
from typing import List, Optional

from ...core.context import ContextProvider
from ...core.main import ChatMessage, ContextItem, ContextItemDescription, ContextItemId
from ...libs.util.filter_files import DEFAULT_IGNORE_PATTERNS
from ...libs.util.logging import logger
from ...server.meilisearch_server import remove_meilisearch_disallowed_chars
from ...server.protocols.ide_protocol import AbstractIdeProtocolServer

MAX_SIZE_IN_CHARS = 50_000


async def get_file_contents(
    filepath: str, ide: AbstractIdeProtocolServer
) -> Optional[str]:
    try:
        return (await ide.readFile(filepath))[:MAX_SIZE_IN_CHARS]
    except Exception as _:
        return None


class FileContextProvider(ContextProvider):
    """
    The FileContextProvider is a ContextProvider that allows you to search files in the open workspace.
    """

    title = "file"
    ignore_patterns: List[str] = DEFAULT_IGNORE_PATTERNS

    display_title = "Files"
    description = "Type to search the workspace"
    dynamic = False

    async def start(self, *args):
        await super().start(*args)

        async def on_file_saved(filepath: str, contents: str):
            item = await self.get_context_item_for_filepath(filepath)
            if item is None:
                return
            await self.update_documents([item], self.ide.workspace_directory)

        async def on_files_created(filepaths: List[str]):
            items = await asyncio.gather(
                *[
                    self.get_context_item_for_filepath(filepath)
                    for filepath in filepaths
                ]
            )
            items = [item for item in items if item is not None]
            await self.update_documents(items, self.ide.workspace_directory)

        async def on_files_deleted(filepaths: List[str]):
            ids = [self.get_id_for_filepath(filepath) for filepath in filepaths]

            await self.delete_documents(ids)

        async def on_files_renamed(old_filepaths: List[str], new_filepaths: List[str]):
            if self.ide.workspace_directory is None:
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
            await self.update_documents(new_docs, self.ide.workspace_directory)

        self.ide.subscribeToFileSaved(on_file_saved)
        self.ide.subscribeToFilesCreated(on_files_created)
        self.ide.subscribeToFilesDeleted(on_files_deleted)
        self.ide.subscribeToFilesRenamed(on_files_renamed)

    async def get_item(self, id: ContextItemId, query: str) -> Optional[ContextItem]:
        if item := await super().get_item(id, query):
            item.description.description = os.path.join(
                self.ide.workspace_directory, item.description.description
            )
        return item

    def get_id_for_filepath(self, absolute_filepath: str) -> str:
        return remove_meilisearch_disallowed_chars(absolute_filepath)

    async def get_chat_message(self, item: ContextItem) -> ChatMessage:
        """Returns the ChatMessage for the given ContextItem."""
        return ChatMessage(
            role="user",
            content=f"```{item.description.name}\n{item.content}\n```",
            summary=item.description.description,
        )

    async def get_context_item_for_filepath(
        self, absolute_filepath: str, content: Optional[str] = None
    ) -> Optional[ContextItem]:
        if content is None:
            content = await get_file_contents(absolute_filepath, self.ide)
        if content is None:
            return None

        workspace_dir = self.ide.workspace_directory
        if (
            os.path.splitdrive(workspace_dir)[0]
            != os.path.splitdrive(absolute_filepath)[0]
        ):
            workspace_dir = (
                os.path.splitdrive(absolute_filepath)[0]
                + os.path.splitdrive(workspace_dir)[1]
            )

        try:
            relative_to_workspace = os.path.relpath(absolute_filepath, workspace_dir)
        except Exception as e:
            logger.warning(f"Error getting relative path: {e}")
            return None

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
        contents = await self.ide.listDirectoryContents(workspace_dir, True)
        if contents is None:
            return []

        absolute_filepaths: List[str] = []
        for filepath in contents[:1000]:
            absolute_filepaths.append(filepath)

        items = []
        i = 0
        timeout = 0.1
        delta = 100
        while i < len(absolute_filepaths):
            # Don't want to flood with too many requests
            items += await asyncio.gather(
                *[
                    self.get_context_item_for_filepath(filepath)
                    for filepath in absolute_filepaths[i : i + delta]
                ]
            )

            i += delta
            await asyncio.sleep(timeout)

        items = list(filter(lambda item: item is not None, items))

        return items

    async def preview_contents(self, id: ContextItemId):
        if item := next(
            filter(lambda x: x.description.id == id, self.selected_items), None
        ):
            await self.ide.setFileOpen(
                os.path.join(
                    self.ide.workspace_directory, item.description.description
                ),
                True,
            )

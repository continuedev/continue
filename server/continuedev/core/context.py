import asyncio
import time
from abc import abstractmethod
from typing import Any, Awaitable, Callable, List, Optional

from meilisearch_python_async import Client
from pydantic import BaseModel, Field

from ..libs.util.create_async_task import create_async_task
from ..libs.util.devdata import dev_data_logger
from ..libs.util.logging import logger
from ..libs.util.paths import migrate
from ..libs.util.telemetry import posthog_logger
from ..server.global_config import global_config
from ..server.meilisearch_server import (
    check_meilisearch_running,
    get_meilisearch_url,
    poll_meilisearch_running,
    remove_meilisearch_disallowed_chars,
    restart_meilisearch,
    start_meilisearch,
)
from ..server.protocols.ide_protocol import AbstractIdeProtocolServer
from .main import (
    ChatMessage,
    ContextItem,
    ContextItemDescription,
    ContextItemId,
    ContextProviderDescription,
)


class ContinueSDK(BaseModel):
    """To avoid circular imports"""

    ...


SEARCH_INDEX_NAME = "continue_context_items"


class ContextProvider(BaseModel):
    """
    The ContextProvider class is a plugin that lets you provide new information to the LLM by typing '@'.
    When you type '@', the context provider will be asked to populate a list of options.
    These options will be updated on each keystroke.
    When you hit enter on an option, the context provider will add that item to the autopilot's list of context (which is all stored in the ContextManager object).
    """

    title: str = Field(
        ...,
        description="The title of the ContextProvider. This is what must be typed in the input to trigger the ContextProvider.",
    )
    ide: Any = None

    delete_documents: Callable[[List[str]], Awaitable] = Field(
        None, description="Function to delete documents"
    )
    update_documents: Callable[[List[ContextItem], str], Awaitable] = Field(
        None, description="Function to update documents"
    )

    display_title: str = Field(
        ...,
        description="The display title of the ContextProvider shown in the dropdown menu",
    )
    description: str = Field(
        ...,
        description="A description of the ContextProvider displayed in the dropdown menu",
    )
    dynamic: bool = Field(
        ..., description="Indicates whether the ContextProvider is dynamic"
    )
    requires_query: bool = Field(
        False,
        description="Indicates whether the ContextProvider requires a query. For example, the SearchContextProvider requires you to type '@search <STRING_TO_SEARCH>'. This will change the behavior of the UI so that it can indicate the expectation for a query.",
    )

    selected_items: List[ContextItem] = Field(
        [], description="List of selected items in the ContextProvider"
    )

    class Config:
        arbitrary_types_allowed = True
        exclude = {"ide", "delete_documents", "update_documents"}

    def get_description(self) -> ContextProviderDescription:
        return ContextProviderDescription(
            title=self.title,
            display_title=self.display_title,
            description=self.description,
            dynamic=self.dynamic,
            requires_query=self.requires_query,
        )

    def dict(self, *args, **kwargs):
        original_dict = super().dict(*args, **kwargs)
        original_dict.pop("ide", None)
        original_dict.pop("delete_documents", None)
        original_dict.pop("update_documents", None)
        return original_dict

    async def start(
        self, ide: AbstractIdeProtocolServer, delete_documents, update_documents
    ):
        """
        Starts the context provider.

        Default implementation sets the sdk.
        """
        self.ide = ide
        self.delete_documents = delete_documents
        self.update_documents = update_documents

    async def get_selected_items(self) -> List[ContextItem]:
        """
        Returns all of the selected ContextItems.

        Default implementation simply returns self.selected_items.

        Other implementations may add an async processing step.
        """
        return self.selected_items

    @abstractmethod
    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        """
        Provide documents for search index. This is run on startup.

        This is the only method that must be implemented.
        """

    async def get_chat_message(self, item: ContextItem) -> ChatMessage:
        """Returns the ChatMessage for the given ContextItem."""
        return ChatMessage(
            role="user",
            content=f"{item.description.name}: {item.description.description}\n\n{item.content}",
            summary=item.description.description,
        )

    async def get_item(self, id: ContextItemId, query: str) -> Optional[ContextItem]:
        """
        Returns the ContextItem with the given id.

        Default implementation uses the search index to get the item.
        """
        async with Client(get_meilisearch_url()) as search_client:
            try:
                result = await search_client.index(SEARCH_INDEX_NAME).get_document(
                    id.to_string()
                )
                return ContextItem(
                    description=ContextItemDescription(
                        name=result["name"], description=result["description"], id=id
                    ),
                    content=result["content"],
                )
            except Exception as e:
                logger.warning(f"Error while retrieving document from meilisearch: {e}")

            return None

    async def clear_context(self):
        """
        Clears all context.

        Default implementation simply clears the selected items.
        """
        self.selected_items = []

    async def add_context_item(self, id: ContextItemId, query: str):
        """
        Adds the given ContextItem to the list of ContextItems.

        Default implementation simply appends the item, not allowing duplicates.

        This method also allows you not to have to load all of the information until an item is selected.
        """

        # Don't add duplicate context
        for item in self.selected_items:
            if item.description.id.item_id == id.item_id:
                return

        if new_item := await self.get_item(id, query):
            self.selected_items.append(new_item)

    async def preview_contents(self, id: ContextItemId):
        """
        Open a virtual file or otherwise preview the contents of the context provider in the IDE
        """
        if item := next(
            filter(lambda x: x.description.id == id, self.selected_items), None
        ):
            await self.ide.showVirtualFile(item.description.name, item.content)


class ContextManager:
    """
    The context manager is responsible for storing the context to be passed to the LLM, including
    - ContextItems (highlighted code, GitHub Issues, etc.)
    - ChatMessages in the history
    - System Message
    - Functions

    It is responsible for compiling all of this information into a single prompt without exceeding the token limit.
    """

    async def get_chat_messages(self, items: List[ContextItem]) -> List[ChatMessage]:
        """
        Returns chat messages from each provider.
        """
        tasks = []
        msgs = []
        for item in items:
            if item.description.id.provider_title in self.context_providers:
                tasks.append(
                    self.context_providers[
                        item.description.id.provider_title
                    ].get_chat_message(item)
                )
            else:
                msgs.append(
                    ChatMessage(
                        role="user",
                        content=item.content,
                        summary=item.description.description,
                    )
                )

        return (await asyncio.gather(*tasks)) + msgs

    def __init__(self):
        self.context_providers = {}
        self.provider_titles = set()

    async def start(
        self,
        context_providers: List[ContextProvider],
        ide: AbstractIdeProtocolServer,
        only_reloading: bool = False,
        disable_indexing: bool = False,
    ):
        """
        Starts the context manager.
        """
        new_context_providers = {
            provider.title: provider
            for provider in context_providers
            if provider.title not in self.provider_titles
        }

        self.context_providers = {
            provider.title: provider for provider in context_providers
        }
        self.provider_titles = {provider.title for provider in context_providers}

        for provider in context_providers:
            await provider.start(
                ide,
                ContextManager.delete_documents,
                ContextManager.update_documents,
            )

        async def on_err(e):
            logger.warning(f"Error loading meilisearch index: {e}")

        # Start MeiliSearch in the background without blocking
        async def load_index(providers_to_load: List[ContextProvider]):
            running = await check_meilisearch_running()
            if not running:
                await start_meilisearch(global_config.meilisearch_url)
                try:
                    await asyncio.wait_for(poll_meilisearch_running(), timeout=20)
                except asyncio.TimeoutError:
                    logger.warning(
                        "Meilisearch did not start in less than 20 seconds. Stopping polling."
                    )
                    return

            ti = time.time()
            await self.load_index(
                ide.workspace_directory, providers_to_load=providers_to_load
            )
            logger.info(f"Loaded Meilisearch index in {time.time() - ti:.3f} seconds")

        providers_to_load = (
            list(new_context_providers.values())
            if only_reloading
            else context_providers
        )

        if not disable_indexing:
            create_async_task(load_index(providers_to_load), on_err)

    @staticmethod
    async def update_documents(context_items: List[ContextItem], workspace_dir: str):
        """
        Updates the documents in the search index.
        """
        documents = [
            {
                "id": item.description.id.to_string(),
                "name": item.description.name,
                "description": item.description.description,
                "content": item.content,
                "workspace_dir": workspace_dir,
                "provider_name": item.description.id.provider_title,
            }
            for item in context_items
        ]
        async with Client(get_meilisearch_url()) as search_client:

            async def add_docs():
                index = await search_client.get_index(SEARCH_INDEX_NAME)
                await index.add_documents(documents or [])

            try:
                await asyncio.wait_for(add_docs(), timeout=20)
            except asyncio.TimeoutError:
                logger.warning("Failed to add document to meilisearch in 20 seconds")
            except Exception as e:
                logger.warning(f"Error adding document to meilisearch: {e}")

    @staticmethod
    async def delete_documents(ids):
        """
        Deletes the documents in the search index.
        """
        async with Client(get_meilisearch_url()) as search_client:
            try:
                await asyncio.wait_for(
                    search_client.index(SEARCH_INDEX_NAME).delete_documents(ids),
                    timeout=20,
                )
            except asyncio.TimeoutError:
                logger.warning(
                    "Failed to delete document from meilisearch in 20 seconds"
                )
            except Exception as e:
                logger.warning(f"Error deleting document from meilisearch: {e}")

    async def load_index(
        self,
        workspace_dir: str,
        should_retry: bool = True,
        providers_to_load: Optional[List[ContextProvider]] = None,
    ):
        try:
            async with Client(get_meilisearch_url()) as search_client:
                # First, create the index if it doesn't exist
                # The index is currently shared by all workspaces

                # Check if need to migrate to new id format
                # If so, delete the index before recreating
                async def migrate_fn():
                    await search_client.delete_index_if_exists(SEARCH_INDEX_NAME)

                await migrate(
                    "meilisearch_context_items_001",
                    migrate_fn,
                )

                await search_client.create_index(SEARCH_INDEX_NAME)
                globalSearchIndex = await search_client.get_index(SEARCH_INDEX_NAME)
                await globalSearchIndex.update_ranking_rules(
                    ["attribute", "words", "typo", "proximity", "sort", "exactness"]
                )
                await globalSearchIndex.update_searchable_attributes(
                    ["name", "description"]
                )
                await globalSearchIndex.update_filterable_attributes(
                    ["workspace_dir", "provider_name"]
                )

                async def load_context_provider(provider: ContextProvider):
                    context_items = await provider.provide_context_items(workspace_dir)
                    documents = [
                        {
                            "id": item.description.id.to_string()
                            + remove_meilisearch_disallowed_chars(workspace_dir),
                            "name": item.description.name,
                            "description": item.description.description,
                            "content": item.content,
                            "workspace_dir": workspace_dir,
                            "provider_name": provider.title,
                        }
                        for item in context_items
                    ]
                    if len(documents) > 0:
                        await globalSearchIndex.add_documents(documents)

                    return len(documents)

                async def safe_load(provider: ContextProvider):
                    try:
                        await asyncio.wait_for(
                            load_context_provider(provider), timeout=20
                        )
                    except asyncio.TimeoutError:
                        logger.warning(
                            f"Failed to add documents to meilisearch for context provider {provider.__class__.__name__} in 20 seconds"
                        )
                        return
                    except Exception as e:
                        logger.warning(
                            f"Error adding documents to meilisearch for context provider {provider.__class__.__name__}: {e}"
                        )
                        return

                    # logger.info(
                    #     f"Loaded {num_documents} documents into meilisearch in {tf - ti} seconds for context provider {provider.title}"
                    # )

                tasks = [
                    safe_load(provider)
                    for _, provider in (
                        {provider.title: provider for provider in providers_to_load}
                        if providers_to_load
                        else self.context_providers
                    ).items()
                ]
                await asyncio.wait_for(asyncio.gather(*tasks), timeout=20)

        except Exception as e:
            logger.debug(f"Error loading meilisearch index: {e}")
            if should_retry:
                try:
                    await restart_meilisearch()
                    await asyncio.wait_for(poll_meilisearch_running(), timeout=20)
                except asyncio.TimeoutError:
                    logger.warning(
                        "Meilisearch did not restart in less than 20 seconds. Stopping polling."
                    )
                await self.load_index(workspace_dir, False)

    async def get_context_item(self, id: str, query: str) -> Optional[ContextItem]:
        """
        Returns the ContextItem with the given id.
        """
        item_id: ContextItemId = ContextItemId.from_string(id)
        if item_id.provider_title not in self.provider_titles:
            raise ValueError(
                f"Context provider with title {item_id.provider_title} not found"
            )

        posthog_logger.capture_event(
            "select_context_item",
            {
                "provider_title": item_id.provider_title,
                "item_id": item_id.item_id,
                "query": query,
            },
        )
        dev_data_logger.capture(
            "select_context_item",
            {
                "provider_title": item_id.provider_title,
                "item_id": item_id.item_id,
                "query": query,
            },
        )

        return await self.context_providers[item_id.provider_title].get_item(
            item_id, query
        )

    async def preview_context_item(self, id: str):
        """
        Opens a virtual file or otherwise previews the contents of the context provider in the IDE.
        """
        item_id: ContextItemId = ContextItemId.from_string(id)
        if item_id.provider_title not in self.provider_titles:
            raise ValueError(
                f"Context provider with title {item_id.provider_title} not found"
            )

        await self.context_providers[item_id.provider_title].preview_contents(item_id)


"""
Should define "ArgsTransformer" and "PromptTransformer" classes for the different LLMs. A standard way for them to ingest the
same format of prompts so you don't have to redo all of this logic.
"""

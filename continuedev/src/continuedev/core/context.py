import asyncio
import time
from abc import abstractmethod
from typing import Awaitable, Callable, Dict, List

from meilisearch_python_async import Client
from pydantic import BaseModel, Field

from ..libs.util.create_async_task import create_async_task
from ..libs.util.devdata import dev_data_logger
from ..libs.util.logging import logger
from ..libs.util.telemetry import posthog_logger
from ..server.meilisearch_server import poll_meilisearch_running, restart_meilisearch
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
    sdk: ContinueSDK = Field(
        None, description="The ContinueSDK instance accessible by the ContextProvider"
    )
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

    def dict(self, *args, **kwargs):
        original_dict = super().dict(*args, **kwargs)
        original_dict.pop("sdk", None)
        original_dict.pop("delete_documents", None)
        original_dict.pop("update_documents", None)
        return original_dict

    async def start(self, sdk: ContinueSDK, delete_documents, update_documents):
        """
        Starts the context provider.

        Default implementation sets the sdk.
        """
        self.sdk = sdk
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

    async def get_chat_messages(self) -> List[ChatMessage]:
        """
        Returns all of the chat messages for the context provider.

        Default implementation has a string template.
        """
        return [
            ChatMessage(
                role="user",
                content=f"{item.description.name}: {item.description.description}\n\n{item.content}",
                summary=item.description.description,
            )
            for item in await self.get_selected_items()
        ]

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        """
        Returns the ContextItem with the given id.

        Default implementation uses the search index to get the item.
        """
        async with Client("http://localhost:7700") as search_client:
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

    async def delete_context_with_ids(self, ids: List[ContextItemId]):
        """
        Deletes the ContextItems with the given IDs, lets ContextProviders recalculate.

        Default implementation simply deletes those with the given ids.
        """
        id_strings = {id.to_string() for id in ids}
        self.selected_items = list(
            filter(
                lambda item: item.description.id.to_string() not in id_strings,
                self.selected_items,
            )
        )

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

    async def manually_add_context_item(self, context_item: ContextItem):
        for item in self.selected_items:
            if item.description.id.item_id == context_item.description.id.item_id:
                return

        self.selected_items.append(context_item)


class ContextManager:
    """
    The context manager is responsible for storing the context to be passed to the LLM, including
    - ContextItems (highlighted code, GitHub Issues, etc.)
    - ChatMessages in the history
    - System Message
    - Functions

    It is responsible for compiling all of this information into a single prompt without exceeding the token limit.
    """

    def get_provider_descriptions(self) -> List[ContextProviderDescription]:
        """
        Returns a list of ContextProviderDescriptions for each context provider.
        """
        return [
            ContextProviderDescription(
                title=provider.title,
                display_title=provider.display_title,
                description=provider.description,
                dynamic=provider.dynamic,
                requires_query=provider.requires_query,
            )
            for provider in self.context_providers.values()
            if provider.title != "code"
        ]

    async def get_selected_items(self) -> List[ContextItem]:
        """
        Returns all of the selected ContextItems.
        """
        return sum(
            [
                await provider.get_selected_items()
                for provider in self.context_providers.values()
            ],
            [],
        )

    async def get_chat_messages(self) -> List[ChatMessage]:
        """
        Returns chat messages from each provider.
        """
        return sum(
            [
                await provider.get_chat_messages()
                for provider in self.context_providers.values()
            ],
            [],
        )

    def __init__(self):
        self.context_providers = {}
        self.provider_titles = set()

    async def start(self, context_providers: List[ContextProvider], sdk: ContinueSDK):
        """
        Starts the context manager.
        """
        # Use only non-meilisearch-dependent providers until it is loaded
        self.context_providers = {
            provider.title: provider
            for provider in context_providers
            if provider.title == "code"
        }
        self.provider_titles = {provider.title for provider in context_providers}

        # Start MeiliSearch in the background without blocking
        async def start_meilisearch(context_providers):
            try:
                await asyncio.wait_for(poll_meilisearch_running(), timeout=20)
                self.context_providers = {
                    prov.title: prov for prov in context_providers
                }
                for provider in context_providers:
                    await provider.start(
                        sdk,
                        ContextManager.delete_documents,
                        ContextManager.update_documents,
                    )

                logger.debug("Loading Meilisearch index...")
                await self.load_index(sdk.ide.workspace_directory)
                logger.debug("Loaded Meilisearch index")
            except asyncio.TimeoutError:
                logger.warning("Meilisearch is not running.")

        create_async_task(start_meilisearch(context_providers))

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
        async with Client("http://localhost:7700") as search_client:

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
        async with Client("http://localhost:7700") as search_client:
            await asyncio.wait_for(
                search_client.index(SEARCH_INDEX_NAME).delete_documents(ids),
                timeout=20,
            )

    async def load_index(self, workspace_dir: str, should_retry: bool = True):
        try:
            async with Client("http://localhost:7700") as search_client:
                # First, create the index if it doesn't exist
                # The index is currently shared by all workspaces
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
                            "id": item.description.id.to_string(),
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
                    ti = time.time()
                    try:
                        num_documents = await asyncio.wait_for(
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

                    tf = time.time()
                    logger.debug(
                        f"Loaded {num_documents} documents into meilisearch in {tf - ti} seconds for context provider {provider.title}"
                    )

                tasks = [
                    safe_load(provider)
                    for _, provider in self.context_providers.items()
                ]
                await asyncio.wait_for(asyncio.gather(*tasks), timeout=20)

        except Exception as e:
            logger.debug(f"Error loading meilisearch index: {e}")
            if should_retry:
                await restart_meilisearch()
                try:
                    await asyncio.wait_for(poll_meilisearch_running(), timeout=20)
                except asyncio.TimeoutError:
                    logger.warning(
                        "Meilisearch did not restart in less than 20 seconds. Stopping polling."
                    )
                await self.load_index(workspace_dir, False)

    async def select_context_item(self, id: str, query: str):
        """
        Selects the ContextItem with the given id.
        """
        id: ContextItemId = ContextItemId.from_string(id)
        if id.provider_title not in self.provider_titles:
            raise ValueError(
                f"Context provider with title {id.provider_title} not found"
            )

        posthog_logger.capture_event(
            "select_context_item",
            {
                "provider_title": id.provider_title,
                "item_id": id.item_id,
                "query": query,
            },
        )
        dev_data_logger.capture(
            "select_context_item",
            {
                "provider_title": id.provider_title,
                "item_id": id.item_id,
                "query": query,
            },
        )
        await self.context_providers[id.provider_title].add_context_item(id, query)

    async def delete_context_with_ids(self, ids: List[str]):
        """
        Deletes the ContextItems with the given IDs, lets ContextProviders recalculate.
        """

        # Group by provider title
        provider_title_to_ids: Dict[str, List[ContextItemId]] = {}
        for id in ids:
            id: ContextItemId = ContextItemId.from_string(id)
            if id.provider_title not in provider_title_to_ids:
                provider_title_to_ids[id.provider_title] = []
            provider_title_to_ids[id.provider_title].append(id)

        # Recalculate context for each updated provider
        for provider_title, ids in provider_title_to_ids.items():
            await self.context_providers[provider_title].delete_context_with_ids(ids)

    async def clear_context(self):
        """
        Clears all context.
        """
        for provider in self.context_providers.values():
            await self.context_providers[provider.title].clear_context()

    async def manually_add_context_item(self, item: ContextItem):
        """
        Adds the given ContextItem to the list of ContextItems.
        """
        if item.description.id.provider_title not in self.provider_titles:
            return

        await self.context_providers[
            item.description.id.provider_title
        ].manually_add_context_item(item)


"""
Should define "ArgsTransformer" and "PromptTransformer" classes for the different LLMs. A standard way for them to ingest the
same format of prompts so you don't have to redo all of this logic.
"""

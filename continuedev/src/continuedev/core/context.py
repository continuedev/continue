
from abc import abstractmethod
from typing import Dict, List
import meilisearch
from pydantic import BaseModel


from .main import ChatMessage, ContextItem, ContextItemDescription, ContextItemId
from ..server.meilisearch_server import check_meilisearch_running


SEARCH_INDEX_NAME = "continue_context_items"


class ContextProvider(BaseModel):
    """
    The ContextProvider class is a plugin that lets you provide new information to the LLM by typing '@'.
    When you type '@', the context provider will be asked to populate a list of options.
    These options will be updated on each keystroke.
    When you hit enter on an option, the context provider will add that item to the autopilot's list of context (which is all stored in the ContextManager object).
    """

    title: str

    selected_items: List[ContextItem] = []

    async def get_selected_items(self) -> List[ContextItem]:
        """
        Returns all of the selected ContextItems.

        Default implementation simply returns self.selected_items.

        Other implementations may add an async processing step.
        """
        return self.selected_items

    @abstractmethod
    async def provide_context_items(self) -> List[ContextItem]:
        """
        Provide documents for search index. This is run on startup.

        This is the only method that must be implemented.
        """

    async def get_chat_messages(self) -> List[ChatMessage]:
        """
        Returns all of the chat messages for the context provider.

        Default implementation has a string template.
        """
        return [ChatMessage(role="user", content=f"{item.description.name}: {item.description.description}\n\n{item.content}", summary=item.description.description) for item in await self.get_selected_items()]

    async def get_item(self, id: ContextItemId, query: str, search_client: meilisearch.Client) -> ContextItem:
        """
        Returns the ContextItem with the given id.

        Default implementation uses the search index to get the item.
        """
        result = search_client.index(
            SEARCH_INDEX_NAME).get_document(id.to_string())
        return ContextItem(
            description=ContextItemDescription(
                name=result.name,
                description=result.description,
                id=id
            ),
            content=result.content
        )

    async def delete_context_with_ids(self, ids: List[ContextItemId]):
        """
        Deletes the ContextItems with the given IDs, lets ContextProviders recalculate.

        Default implementation simply deletes those with the given ids.
        """
        id_strings = {id.to_string() for id in ids}
        self.selected_items = list(
            filter(lambda item: item.description.id.to_string() not in id_strings, self.selected_items))

    async def clear_context(self):
        """
        Clears all context.

        Default implementation simply clears the selected items.
        """
        self.selected_items = []

    async def add_context_item(self, id: ContextItemId, query: str, search_client: meilisearch.Client):
        """
        Adds the given ContextItem to the list of ContextItems.

        Default implementation simply appends the item, not allowing duplicates.

        This method also allows you not to have to load all of the information until an item is selected.
        """

        # Don't add duplicate context
        for item in self.selected_items:
            if item.description.id.item_id == id.item_id:
                return

        new_item = await self.get_item(id, query, search_client)
        self.selected_items.append(new_item)


class ContextManager:
    """
    The context manager is responsible for storing the context to be passed to the LLM, including
    - ContextItems (highlighted code, GitHub Issues, etc.)
    - ChatMessages in the history
    - System Message
    - Functions

    It is responsible for compiling all of this information into a single prompt without exceeding the token limit.
    """

    async def get_selected_items(self) -> List[ContextItem]:
        """
        Returns all of the selected ContextItems.
        """
        return sum([await provider.get_selected_items() for provider in self.context_providers.values()], [])

    async def get_chat_messages(self) -> List[ChatMessage]:
        """
        Returns chat messages from each provider.
        """
        return sum([await provider.get_chat_messages() for provider in self.context_providers.values()], [])

    search_client: meilisearch.Client

    def __init__(self, context_providers: List[ContextProvider]):
        self.search_client = meilisearch.Client('http://localhost:7700')

        # If meilisearch isn't running, don't use any ContextProviders that might depend on it
        if not check_meilisearch_running():
            context_providers = list(
                filter(lambda cp: cp.title == "code", context_providers))

        self.context_providers = {
            prov.title: prov for prov in context_providers}
        self.provider_titles = {
            provider.title for provider in context_providers}

    async def load_index(self):
        for _, provider in self.context_providers.items():
            context_items = await provider.provide_context_items()
            documents = [
                {
                    "id": item.description.id.to_string(),
                    "name": item.description.name,
                    "description": item.description.description,
                    "content": item.content
                }
                for item in context_items
            ]
            if len(documents) > 0:
                self.search_client.index(
                    SEARCH_INDEX_NAME).add_documents(documents)

    # def compile_chat_messages(self, max_tokens: int) -> List[Dict]:
    #     """
    #     Compiles the chat prompt into a single string.
    #     """
    #     return compile_chat_messages(self.model, self.chat_history, max_tokens, self.prompt, self.functions, self.system_message)

    async def select_context_item(self, id: str, query: str):
        """
        Selects the ContextItem with the given id.
        """
        id: ContextItemId = ContextItemId.from_string(id)
        if id.provider_title not in self.provider_titles:
            raise ValueError(
                f"Context provider with title {id.provider_title} not found")

        await self.context_providers[id.provider_title].add_context_item(id, query, self.search_client)

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


"""
Should define "ArgsTransformer" and "PromptTransformer" classes for the different LLMs. A standard way for them to ingest the
same format of prompts so you don't have to redo all of this logic.
"""

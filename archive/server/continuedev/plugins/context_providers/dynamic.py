from abc import ABC, abstractmethod
from typing import List

from ...core.context import ContextProvider
from ...core.main import ContextItem, ContextItemDescription, ContextItemId
from ...libs.util.create_async_task import create_async_task
from .util import remove_meilisearch_disallowed_chars, remove_prefix


class DynamicProvider(ContextProvider, ABC):
    """
    A title representing the provider
    """

    title: str
    """A name representing the provider. Probably use capitalized version of title"""

    name: str

    dynamic: bool = True

    @property
    def BASE_CONTEXT_ITEM(self):
        return ContextItem(
            content="",
            description=ContextItemDescription(
                name=self.name,
                description=self.description,
                id=ContextItemId(provider_title=self.title, item_id=self.title),
            ),
        )

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        create_async_task(self.setup())
        return [self.BASE_CONTEXT_ITEM]

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        if not id.provider_title == self.title:
            raise Exception("Invalid provider title for item")

        query = remove_prefix(text=query, prefix=self.title).strip()
        results = await self.get_content(query)

        ctx_item = self.BASE_CONTEXT_ITEM.copy()
        ctx_item.content = results
        ctx_item.description.name = f"{self.name}: '{query}'"
        ctx_item.description.id.item_id = remove_meilisearch_disallowed_chars(query)
        return ctx_item

    @abstractmethod
    async def get_content(self, query: str) -> str:
        """Retrieve the content given the query
        (e.g. search the codebase, return search results)"""
        raise NotImplementedError

    @abstractmethod
    async def setup(self):
        """Run any setup needed (e.g. indexing the codebase)"""
        raise NotImplementedError


"""
class ExampleDynamicProvider(DynamicProvider):
    title = "example"
    name = "Example"
    description = "Example description"

    async def get_content(self, query: str) -> str:
        return f"Example content for '{query}'"

    async def setup(self):
        print("Example setup")
"""


from typing import List, Optional

from .util import remove_meilisearch_disallowed_chars
from ...core.main import ContextItem, ContextItemDescription, ContextItemId
from ...core.context import ContextProvider


class URLContextProvider(ContextProvider):
    title = "url"

    # Allows users to provide a list of urls that will 
    commonly_referenced_urls: List[str] = []
    
    # There is only a single dynamic url context item, so it has a static id
    DYNAMIC_URL_CONTEXT_ITEM_ID = "url"

    # This is a template dynamic item that will generate context item on demand
    # when get item is called
    @property
    def DYNAMIC_CONTEXT_ITEM(self):
        return ContextItem(
            content="",
            description=ContextItemDescription(
                name="Dynamic URL",
                description="Reference the contents of a webpage (e.g. '@url https://www.w3schools.com/python/python_ref_functions.asp')",
                id=ContextItemId(
                    provider_title=self.title,
                    item_id=self.DYNAMIC_URL_CONTEXT_ITEM_ID
                )
            )
        )
    
    # These are staticaly configured items, they will be regenerated 
    # each time they are accessed
    @property
    def static_url_context_items_from_config(self) -> List[ContextItem]:
        return [
            ContextItem(
                content=self._get_url_text_contents(url),
                description=ContextItemDescription(
                    name="Static URL",
                    description=f"Contents of {url}",
                    id=ContextItemId(
                        provider_title=self.title,
                        item_id=remove_meilisearch_disallowed_chars(url)
                    )
                )
            )
            for url in self.commonly_referenced_urls
        ]

    def _get_url_text_contents(self, url: str):
        from bs4 import BeautifulSoup
        import requests

        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')
        return soup.get_text()

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        items = [self.DYNAMIC_CONTEXT_ITEM]
        items.extend(self.static_url_context_items_from_config)

        return items

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        static_items = self.static_url_context_items_from_config
        
        # Check if the item is a static item
        matching_static_item = next((item for item in static_items if item.description.id.item_id == id.item_id), None)
        if matching_static_item:
            matching_static_item.description.name = url.replace(
            "https://", "").replace("http://", "")
            return matching_static_item

        # Check if the item is the dynamic item
        if not id.item_id == self.DYNAMIC_URL_CONTEXT_ITEM_ID:
            raise Exception("Invalid item id")

        # Generate the dynamic item
        url = query.lstrip("url ").strip()
        if url is None or url == "":
            return None
        content = self._get_url_text_contents(url)

        ctx_item = self.DYNAMIC_CONTEXT_ITEM.copy()
        ctx_item.content = content
        ctx_item.description.name = url.replace(
            "https://", "").replace("http://", "")
        ctx_item.description.id.item_id = remove_meilisearch_disallowed_chars(
            url)
        return ctx_item

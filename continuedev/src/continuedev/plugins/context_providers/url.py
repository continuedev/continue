from typing import List, Optional

from .util import remove_meilisearch_disallowed_chars
from ...core.main import ContextItem, ContextItemDescription, ContextItemId
from ...core.context import ContextProvider


class URLContextProvider(ContextProvider):
    title = "url"

    url: Optional[str] = None
    display_name: Optional[str] = None
    URL_CONTEXT_ITEM_ID = "url"

    @property
    def optional_url_item_id(self) -> str:
        return remove_meilisearch_disallowed_chars(self.url)

    @property
    def optional_url_item(self) -> ContextItem:
        cp = self.BASE_CONTEXT_ITEM.copy()
        if self.display_name:
            cp.description.name = self.display_name
        cp.description.description = f"Contents of {self.url}"
        cp.description.id.item_id = self.optional_url_item_id

        return cp

    @property
    def BASE_CONTEXT_ITEM(self):
        return ContextItem(
            content="",
            description=ContextItemDescription(
                name="URL",
                description="Reference the contents of a webpage (e.g. '@url https://www.w3schools.com/python/python_ref_functions.asp')",
                id=ContextItemId(
                    provider_title=self.title,
                    item_id=self.URL_CONTEXT_ITEM_ID
                )
            )
        )

    def _get_url_text_contents(self, url: str):
        from bs4 import BeautifulSoup
        import requests

        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')
        return soup.get_text()

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        items = [self.BASE_CONTEXT_ITEM]
        if self.url:
            items.append(self.optional_url_item)

        return items

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        if id.item_id == self.optional_url_item_id:
            item = self.optional_url_item
            item.content = self._get_url_text_contents(self.url)
            return item

        if not id.item_id == self.URL_CONTEXT_ITEM_ID:
            raise Exception("Invalid item id")

        url = query.lstrip("url ").strip()
        content = self._get_url_text_contents(url)

        ctx_item = self.BASE_CONTEXT_ITEM.copy()
        ctx_item.content = content
        ctx_item.description.name = url.replace(
            "https://", "").replace("http://", "")
        ctx_item.description.id.item_id = remove_meilisearch_disallowed_chars(
            url)
        return ctx_item

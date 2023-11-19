from typing import List, Optional, Tuple

import requests
from bs4 import BeautifulSoup
from pydantic import Field

from ...core.context import ContextProvider
from ...core.main import ContextItem, ContextItemDescription, ContextItemId
from .util import remove_meilisearch_disallowed_chars, remove_prefix


class URLContextProvider(ContextProvider):
    """Type '@url' to reference the contents of a URL. You can either reference preset URLs, or reference one dynamically by typing '@url https://example.com'. The text contents of the page will be fetched and used as context."""

    title = "url"
    display_title = "URL"
    description = "Reference the contents of a webpage"
    dynamic = True
    requires_query = True

    # Allows users to provide a list of preset urls
    preset_urls: List[str] = Field(
        [],
        description="A list of preset URLs that you will be able to quickly reference by typing '@url'",
    )

    # Static items loaded from preset_urls
    static_url_context_items: List[ContextItem] = []

    # There is only a single dynamic url context item, so it has a static id
    _DYNAMIC_URL_CONTEXT_ITEM_ID = "url"

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
                    provider_title=self.title, item_id=self._DYNAMIC_URL_CONTEXT_ITEM_ID
                ),
            ),
        )

    def static_url_context_item_from_url(self, url: str) -> ContextItem:
        content, title = self._get_url_text_contents_and_title(url)
        return ContextItem(
            content=content,
            description=ContextItemDescription(
                name=title,
                description=f"Contents of {url}",
                id=ContextItemId(
                    provider_title=self.title,
                    item_id=remove_meilisearch_disallowed_chars(url),
                ),
            ),
        )

    def _get_url_text_contents_and_title(self, url: str) -> Tuple[str, str]:
        if not url.startswith("http"):
            url = "https://" + url

        response = requests.get(url)
        soup = BeautifulSoup(response.text, "html.parser")
        title = url.replace("https://", "").replace("http://", "").replace("www.", "")
        if soup.title is not None:
            title = soup.title.string or title
        return soup.get_text(), title

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        self.static_url_context_items = [
            self.static_url_context_item_from_url(url) for url in self.preset_urls
        ]

        return [self.DYNAMIC_CONTEXT_ITEM] + self.static_url_context_items

    async def get_item(self, id: ContextItemId, query: str) -> Optional[ContextItem]:
        # Check if the item is a static item
        matching_static_item = next(
            (
                item
                for item in self.static_url_context_items
                if item.description.id.item_id == id.item_id
            ),
            None,
        )
        if matching_static_item:
            return matching_static_item

        # Check if the item is the dynamic item
        if not id.provider_title == self.title:
            raise Exception("Invalid provider title for item")

        # Generate the dynamic item
        url = remove_prefix(text=query, prefix="url").strip()
        if url is None or url == "":
            return None
        content, title = self._get_url_text_contents_and_title(url)

        ctx_item = self.DYNAMIC_CONTEXT_ITEM.copy()
        ctx_item.content = content
        ctx_item.description.name = title
        ctx_item.description.id.item_id = remove_meilisearch_disallowed_chars(url)
        return ctx_item

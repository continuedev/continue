from typing import List

from .util import remove_meilisearch_disallowed_chars
from ...core.main import ContextItem, ContextItemDescription, ContextItemId
from ...core.context import ContextProvider


class URLContextProvider(ContextProvider):
    title = "url"

    URL_CONTEXT_ITEM_ID = "url"

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
        import requests

        response = requests.get(url)
        return response.text

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        self.workspace_dir = workspace_dir
        return [self.BASE_CONTEXT_ITEM]

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        if not id.item_id == self.URL_CONTEXT_ITEM_ID:
            raise Exception("Invalid item id")

        query = query.lstrip("url ")
        url = query.strip()
        content = await self._get_url_text_contents(url)

        ctx_item = self.BASE_CONTEXT_ITEM.copy()
        ctx_item.content = content
        ctx_item.description.name = url.replace(
            "https://", "").replace("http://", "")
        ctx_item.description.id.item_id = remove_meilisearch_disallowed_chars(
            query)
        return ctx_item

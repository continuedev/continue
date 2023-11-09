import json
from typing import List

import aiohttp
from pydantic import Field

from ...core.context import ContextProvider
from ...core.main import ContextItem, ContextItemDescription, ContextItemId
from ...server.meilisearch_server import remove_meilisearch_disallowed_chars


class GoogleContextProvider(ContextProvider):
    """Type '@google' to reference the results of a Google search. For example, type "@google python tutorial" if you want to search and discuss ways of learning Python."""

    title = "google"
    display_title = "Google"
    description = "Search Google"
    dynamic = True
    requires_query = True

    serper_api_key: str = Field(
        ...,
        description="Your SerpAPI key, used to programmatically make Google searches. You can get a key at https://serper.dev.",
    )

    _GOOGLE_CONTEXT_ITEM_ID = "google_search"

    @property
    def BASE_CONTEXT_ITEM(self):
        return ContextItem(
            content="",
            description=ContextItemDescription(
                name="Google Search",
                description="Enter a query to search google",
                id=ContextItemId(
                    provider_title=self.title, item_id=self._GOOGLE_CONTEXT_ITEM_ID
                ),
            ),
        )

    async def _google_search(self, query: str) -> str:
        url = "https://google.serper.dev/search"

        payload = json.dumps({"q": query})
        headers = {"X-API-KEY": self.serper_api_key, "Content-Type": "application/json"}

        async with aiohttp.ClientSession(trust_env=True) as session:
            async with session.post(url, headers=headers, data=payload) as response:
                return await response.text()

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        return [self.BASE_CONTEXT_ITEM]

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        if not id.provider_title == self.title:
            raise Exception("Invalid provider title for item")

        results = await self._google_search(query)
        json_results = json.loads(results)
        content = f"Google Search: {query}\n\n"
        if answerBox := json_results.get("answerBox"):
            content += f"Answer Box ({answerBox['title']}): {answerBox['answer']}\n\n"

        for result in json_results["organic"]:
            content += f"{result['title']}\n{result['link']}\n{result['snippet']}\n\n"

        ctx_item = self.BASE_CONTEXT_ITEM.copy()
        ctx_item.content = content
        ctx_item.description.id.item_id = remove_meilisearch_disallowed_chars(query)
        return ctx_item

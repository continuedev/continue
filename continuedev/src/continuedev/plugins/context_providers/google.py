import json
from typing import List

import aiohttp
from ...core.main import ContextItem, ContextItemDescription, ContextItemId
from ...core.context import ContextProvider


class GoogleContextProvider(ContextProvider):
    title = "google"

    serper_api_key: str

    GOOGLE_CONTEXT_ITEM_ID = "google_search"

    @property
    def BASE_CONTEXT_ITEM(self):
        return ContextItem(
            content="",
            description=ContextItemDescription(
                name="Google Search",
                description="Enter a query to search google",
                id=ContextItemId(
                    provider_title=self.title,
                    item_id=self.GOOGLE_CONTEXT_ITEM_ID
                )
            )
        )

    async def _google_search(self, query: str) -> str:
        url = "https://google.serper.dev/search"

        payload = json.dumps({
            "q": query
        })
        headers = {
            'X-API-KEY': self.serper_api_key,
            'Content-Type': 'application/json'
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, data=payload) as response:
                return await response.text()

    async def provide_context_items(self) -> List[ContextItem]:
        return [self.BASE_CONTEXT_ITEM]

    async def get_item(self, id: ContextItemId, query: str, _) -> ContextItem:
        if not id.item_id == self.GOOGLE_CONTEXT_ITEM_ID:
            raise Exception("Invalid item id")

        results = await self._google_search(query)
        json_results = json.loads(results)
        content = f"Google Search: {query}\n\n"
        if answerBox := json_results.get("answerBox"):
            content += f"Answer Box ({answerBox['title']}): {answerBox['answer']}\n\n"

        for result in json_results["organic"]:
            content += f"{result['title']}\n{result['link']}\n{result['snippet']}\n\n"

        ctx_item = self.BASE_CONTEXT_ITEM.copy()
        ctx_item.content = content
        ctx_item.description.id.item_id = query
        return ctx_item

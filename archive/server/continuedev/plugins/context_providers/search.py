from typing import List

from pydantic import Field
from ripgrepy import Ripgrepy

from ...core.context import ContextProvider
from ...core.main import ContextItem, ContextItemDescription, ContextItemId
from ...libs.util.logging import logger
from ...libs.util.ripgrep import get_rg_path
from .util import remove_meilisearch_disallowed_chars, remove_prefix


class SearchContextProvider(ContextProvider):
    """Type '@search' to reference the results of codebase search, just like the results you would get from VS Code search."""

    title = "search"
    display_title = "Search"
    description = "Search workspace for exact matches"
    dynamic = True
    requires_query = True

    _SEARCH_CONTEXT_ITEM_ID = "search"

    workspace_dir: str = Field(None, description="The workspace directory to search")

    @property
    def BASE_CONTEXT_ITEM(self):
        return ContextItem(
            content="",
            description=ContextItemDescription(
                name="Search",
                description="Search the workspace for all matches of an exact string (e.g. '@search console.log')",
                id=ContextItemId(
                    provider_title=self.title, item_id=self._SEARCH_CONTEXT_ITEM_ID
                ),
            ),
        )

    async def _search(self, query: str) -> str:
        rg = Ripgrepy(query, self.workspace_dir, rg_path=get_rg_path())
        results = rg.I().context(2).run()
        return f"Search results in workspace for '{query}':\n\n{results}"

        # Custom display below - TODO

        # Gather results per file
        file_to_matches = {}
        for result in results:
            if result["type"] == "match":
                data = result["data"]
                filepath = data["path"]["text"]
                if filepath not in file_to_matches:
                    file_to_matches[filepath] = []

                line_num_and_line = f"{data['line_number']}: {data['lines']['text']}"
                file_to_matches[filepath].append(line_num_and_line)

        # Format results
        content = f"Search results in workspace for '{query}':\n\n"
        for filepath, matches in file_to_matches.items():
            content += f"{filepath}\n"
            for match in matches:
                content += f"{match}\n"
            content += "\n"

        return content

    async def provide_context_items(self, workspace_dir: str) -> List[ContextItem]:
        self.workspace_dir = workspace_dir

        try:
            Ripgrepy("", workspace_dir, rg_path=get_rg_path())
        except Exception as e:
            logger.warning(f"Failed to initialize ripgrepy: {e}")
            return []

        return [self.BASE_CONTEXT_ITEM]

    async def get_item(self, id: ContextItemId, query: str) -> ContextItem:
        if not id.provider_title == self.title:
            raise Exception("Invalid provider title for item")

        query = remove_prefix(text=query, prefix="search").strip()
        results = await self._search(query)

        ctx_item = self.BASE_CONTEXT_ITEM.copy()
        ctx_item.content = results
        ctx_item.description.name = f"Search: '{query}'"
        ctx_item.description.id.item_id = remove_meilisearch_disallowed_chars(query)
        return ctx_item

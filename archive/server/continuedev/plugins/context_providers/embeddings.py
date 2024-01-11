import os
import uuid
from typing import List, Optional

from pydantic import BaseModel

from ...core.context import ContextProvider
from ...core.main import ContextItem, ContextItemDescription, ContextItemId


class EmbeddingResult(BaseModel):
    filename: str
    content: str


class EmbeddingsProvider(ContextProvider):
    title = "embed"

    display_title = "Embeddings Search"
    description = "Search the codebase using embeddings"
    dynamic = True
    requires_query = True

    workspace_directory: str

    EMBEDDINGS_CONTEXT_ITEM_ID = "embeddings"

    index_manager: Optional[ChromaIndexManager] = None

    class Config:
        arbitrary_types_allowed = True

    @property
    def index(self):
        if self.index_manager is None:
            self.index_manager = ChromaIndexManager(self.workspace_directory)
        return self.index_manager

    @property
    def BASE_CONTEXT_ITEM(self):
        return ContextItem(
            content="",
            description=ContextItemDescription(
                name="Embedding Search",
                description="Enter a query to embedding search codebase",
                id=ContextItemId(
                    provider_title=self.title, item_id=self.EMBEDDINGS_CONTEXT_ITEM_ID
                ),
            ),
        )

    async def _get_query_results(self, query: str) -> List[EmbeddingResult]:
        results = self.index.query_codebase_index(query)

        ret = []
        for node in results.source_nodes:
            resource_name = list(node.node.relationships.values())[0]
            filepath = resource_name[: resource_name.index("::")]
            ret.append(EmbeddingResult(filename=filepath, content=node.node.text))

        return ret

    async def provide_context_items(self) -> List[ContextItem]:
        self.index.create_codebase_index()  # TODO Synchronous here is not ideal

        return [self.BASE_CONTEXT_ITEM]

    async def add_context_item(self, id: ContextItemId, query: str):
        if not id.provider_title == self.title:
            raise Exception("Invalid provider title for item")

        results = await self._get_query_results(query)

        for i in range(len(results)):
            result = results[i]
            ctx_item = self.BASE_CONTEXT_ITEM.copy()
            ctx_item.description.name = os.path.basename(result.filename)
            ctx_item.content = f"{result.filename}\n```\n{result.content}\n```"
            ctx_item.description.id.item_id = uuid.uuid4().hex
            self.selected_items.append(ctx_item)

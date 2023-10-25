import asyncio
import os
from typing import Coroutine, Dict, List, Optional, Union

from ...libs.index.chunkers.chunk_directory import chunk_directory

from ...libs.index.indices.meilisearch_index import MeilisearchCodebaseIndex

from ...libs.llm.base import CompletionOptions
from ...libs.index.rerankers.default import default_reranker_parallel
from ...libs.util.strings import shorten_filepaths

from pydantic import Field

from ...core.main import ContextItem, ContextItemDescription, ContextItemId, Step
from ...core.observation import Observation
from ...core.sdk import ContinueSDK
from ...core.steps import EditFileStep
from ...libs.index.indices.chroma_index import MAX_CHUNK_SIZE, ChromaCodebaseIndex
from ...server.meilisearch_server import remove_meilisearch_disallowed_chars
from .chat import SimpleChatStep
from ...core.steps import EditFileStep


class CreateCodebaseIndexChroma(Step):
    name: str = "Create Codebase Index"
    hide: bool = True
    description: str = "Generating codebase embeddings... 1%"
    openai_api_key: Optional[str] = Field(None, description="OpenAI API key")
    api_base: Optional[str] = Field(None, description="OpenAI API base URL")
    api_type: Optional[str] = Field(None, description="OpenAI API type")
    api_version: Optional[str] = Field(None, description="OpenAI API version")
    organization_id: Optional[str] = Field(None, description="OpenAI organization ID")

    ignore_files: List[str] = Field(
        [],
        description="Files to ignore when indexing the codebase. You can use glob patterns, such as **/*.py. This is useful for directories that contain generated code, or other directories that are not relevant to the codebase.",
    )

    async def describe(self, models) -> Coroutine[str, None, None]:
        return "Generated codebase embeddings."

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        chroma_index = ChromaCodebaseIndex(
            sdk.ide.workspace_directory,
            openai_api_key=self.openai_api_key,
            api_base=self.api_base,
            api_type=self.api_type,
            api_version=self.api_version,
            organization_id=self.organization_id,
        )
        meilisearch_index = MeilisearchCodebaseIndex(sdk.ide.workspace_directory)

        indices_to_build = 0
        chroma_exists = await chroma_index.exists()
        meilisearch_exists = await meilisearch_index.exists()
        if not chroma_exists:
            indices_to_build += 1
        if not meilisearch_exists:
            indices_to_build += 1

        if indices_to_build == 0:
            return

        self.hide = False

        chunks = await chunk_directory(sdk, MAX_CHUNK_SIZE)

        total_progress = 0
        if not chroma_exists:
            async for progress in chroma_index.build(
                sdk, ignore_files=self.ignore_files, chunks=chunks
            ):
                self.description = f"Generating codebase embeddings... {int(progress*100 / indices_to_build)}%"
                print(self.description, flush=True)
                await sdk.update_ui()

            total_progress += 50

        if not meilisearch_exists:
            async for progress in meilisearch_index.build(
                sdk, ignore_files=self.ignore_files, chunks=chunks
            ):
                self.description = f"Generating codebase embeddings... {int(progress*100 / indices_to_build + total_progress)}%"
                print(self.description, flush=True)
                await sdk.update_ui()

        await asyncio.sleep(1)
        self.hide = True


class AnswerQuestionChroma(Step):
    user_input: str
    _answer: Union[str, None] = None
    name: str = "Answer Question"

    n_retrieve: Optional[int] = Field(
        50, description="Number of results to initially retrieve from vector database"
    )
    n_final: Optional[int] = Field(
        10, description="Final number of results to use after re-ranking"
    )

    use_reranking: bool = Field(
        True,
        description="Whether to use re-ranking, which will allow initial selection of n_retrieve results, then will use an LLM to select the top n_final results",
    )
    rerank_group_size: int = Field(
        5,
        description="Number of results to group together when re-ranking. Each group will be processed in parallel.",
    )
    openai_api_key: str = Field(
        None, description="OpenAI API key. Required if use_reranking is True"
    )

    hide: bool = True

    async def describe(self, llm) -> Coroutine[str, None, None]:
        if self._answer is None:
            return f"Answering the question: {self.user_input}"
        else:
            return self._answer

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        chroma_index = ChromaCodebaseIndex(
            sdk.ide.workspace_directory, openai_api_key=self.openai_api_key
        )
        meilisearch_index = MeilisearchCodebaseIndex(sdk.ide.workspace_directory)

        self.hide = False
        self.description = f"Scanning {self.n_retrieve} files..."
        await sdk.update_ui()

        # Get top chunks from index
        to_retrieve_from_each = (
            self.n_retrieve if self.use_reranking else self.n_final
        ) // 2
        chroma_chunks = await chroma_index.query(
            self.user_input, n=to_retrieve_from_each
        )
        meilisearch_chunks = await meilisearch_index.query(
            self.user_input, n=to_retrieve_from_each
        )
        chunk_ids = set()
        chunks = []
        for chunk in chroma_chunks + meilisearch_chunks:
            if chunk.id not in chunk_ids:
                chunk_ids.add(chunk.id)
                chunks.append(chunk)

        # Rerank to select top results
        self.description = f"Selecting most important files..."
        await sdk.update_ui()

        if self.use_reranking:
            chunks = await default_reranker_parallel(
                chunks,
                self.user_input,
                self.n_final,
                sdk,
                group_size=self.rerank_group_size,
            )

        # Add context items
        context_items: List[ContextItem] = []
        for chunk in chunks:
            # Can we select the context item through the normal means so that the name is disambiguated?
            # Also so you don't have to understand the internals of the context provider
            # OR have a chunk context provider??? Nice short-term, but I don't like it for long-term
            ctx_item = ContextItem(
                content=chunk.content,
                description=ContextItemDescription(
                    name=f"{os.path.basename(chunk.document_id)} ({chunk.start_line}-{chunk.end_line})",
                    description=chunk.document_id,
                    id=ContextItemId(
                        provider_title="file",
                        item_id=remove_meilisearch_disallowed_chars(chunk.document_id),
                    ),
                ),
            )  # Should be 'code' not file! And eventually should be able to embed all context providers automatically!

            context_items.append(ctx_item)
            await sdk.add_context_item(ctx_item)

        self.hide = True
        model = sdk.models.chat.model
        # if model == "gpt-4":
        #     model = "gpt-4-32k"  # Not publicly available yet?
        if model == "gpt-3.5-turbo":
            model = "gpt-3.5-turbo-16k"

        await sdk.run_step(
            SimpleChatStep(
                name="Answer Question",
                description=f"Reading from {len(context_items)} files...",
                completion_options=CompletionOptions(model=model),
            )
        )

        # for ctx_item in context_items:
        #     await sdk.delete_context_item(ctx_item.description.id)


class EditFileChroma(Step):
    user_input: str
    hide: bool = True

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        index = ChromaCodebaseIndex(sdk.ide.workspace_directory)
        results = index.query_codebase_index(self.user_input)

        resource_name = list(results.source_nodes[0].node.relationships.values())[0]
        filepath = resource_name[: resource_name.index("::")]

        await sdk.run_step(
            EditFileStep(
                filepath=filepath,
                prompt=f"Here is the code:\n\n{{code}}\n\nHere is the user request:\n\n{self.user_input}\n\nHere is the code after making the requested changes:\n",
            )
        )

import asyncio
import os
from typing import Coroutine, List, Union

from ...libs.index.hyde import code_hyde
from ...libs.index.indices.meilisearch_index import MeilisearchCodebaseIndex
from ...libs.llm.base import CompletionOptions
from ...libs.index.rerankers.single_token import single_token_reranker_parallel
from ...core.main import (
    ContextItem,
    ContextItemDescription,
    ContextItemId,
    SetStep,
    Step,
)
from ...core.sdk import ContinueSDK
from ...core.steps import EditFileStep
from ...libs.index.indices.chroma_index import ChromaCodebaseIndex
from ...server.meilisearch_server import remove_meilisearch_disallowed_chars
from .chat import SimpleChatStep


class AnswerQuestionChroma(Step):
    user_input: str
    _answer: Union[str, None] = None
    name: str = "Answer Question"

    hide: bool = True

    async def describe(self, llm) -> Coroutine[str, None, None]:
        if self._answer is None:
            return f"Answering the question: {self.user_input}"
        else:
            return self._answer

    async def run(self, sdk: ContinueSDK):
        settings = sdk.config.retrieval_settings

        chroma_index = ChromaCodebaseIndex(
            sdk.ide.workspace_directory, openai_api_key=settings.openai_api_key
        )
        meilisearch_index = MeilisearchCodebaseIndex(sdk.ide.workspace_directory)

        yield SetStep(hide=False, description="Scanning codebase...")

        # Get top chunks from index
        to_retrieve_from_each = (
            settings.n_retrieve if settings.use_reranking else settings.n_final
        ) // 2
        hyde = await code_hyde(self.user_input, "", sdk)
        chroma_chunks = await chroma_index.query(hyde, n=to_retrieve_from_each)
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
        yield SetStep(description="Selecting most important files...")

        if settings.use_reranking:
            chunks = await single_token_reranker_parallel(
                chunks,
                self.user_input,
                settings.n_final,
                sdk,
                # group_size=settings.rerank_group_size,
            )

        # Add context items
        context_items: List[ContextItem] = []
        i = 0
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
            if i < 8:
                await asyncio.sleep(0.06)
            i += 1

        yield SetStep(hide=True)

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

    async def run(self, sdk: ContinueSDK):
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

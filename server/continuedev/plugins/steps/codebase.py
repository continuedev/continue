import asyncio
import os
from typing import List, Optional, Union

from ...core.config import ModelDescription, RetrievalSettings
from ...core.main import (
    ContextItem,
    ContextItemDescription,
    ContextItemId,
    SetStep,
    Step,
)
from ...core.sdk import ContinueSDK
from ...core.steps import EditFileStep
from ...libs.index.hyde import code_hyde, generate_keywords
from ...libs.index.indices.chroma_index import ChromaCodebaseIndex
from ...libs.index.indices.meilisearch_index import MeilisearchCodebaseIndex
from ...libs.index.rerankers.single_token import single_token_reranker_parallel
from ...libs.llm.base import LLM, CompletionOptions
from ...server.meilisearch_server import remove_meilisearch_disallowed_chars
from .chat import SimpleChatStep

PROMPT = """Use the above code to answer the following question. You should not reference any files outside of what is shown, unless they are commonly known files, like a .gitignore or package.json. Reference the filenames whenever possible. If there isn't enough information to answer the question, suggest where the user might look to learn more. Here is the question: '{user_input}'. Response: """


async def get_faster_model(sdk: ContinueSDK) -> Optional[LLM]:
    def get_model_description() -> Optional[ModelDescription]:
        # First, check for GPT-3/3.5
        models = sdk.config.models
        if gpt3_model := next(filter(lambda m: "gpt-3" in m.model, models), None):
            return gpt3_model

        # Then, check for OpenAIFreeTrial
        if openai_free_trial_model := next(
            filter(lambda m: m.__class__.__name__ == "OpenAIFreeTrial", models), None
        ):
            new_model = openai_free_trial_model.copy()
            new_model.model = "gpt-3.5-turbo"
            return new_model

        # Then, check for an API Key
        if openai_model := next(
            filter(
                lambda m: hasattr(m, "api_key")
                and m.api_key is not None
                and m.api_key.startswith("sk-"),
                models,
            ),
            None,
        ):
            new_model = openai_model.copy()
            new_model.model = "gpt-3.5-turbo"
            return new_model

        # Return None, so re-ranking probably shouldn't happen
        return None

    if desc := get_model_description():
        llm = sdk.config.create_llm(desc)
        llm.start(sdk.ide.window_info.unique_id)
    else:
        return None


class AnswerQuestionChroma(Step):
    user_input: str
    _answer: Union[str, None] = None
    name: str = "Answer Question"

    hide: bool = True

    async def describe(self, llm) -> str:
        if self._answer is None:
            return f"Answering the question: {self.user_input}"
        else:
            return self._answer

    async def run(self, sdk: ContinueSDK):
        settings = sdk.config.retrieval_settings or RetrievalSettings()
        faster_model = await get_faster_model(sdk)
        use_reranking = settings.use_reranking and faster_model is not None

        chroma_index = ChromaCodebaseIndex(
            sdk.ide.workspace_directory, openai_api_key=settings.openai_api_key
        )
        meilisearch_index = MeilisearchCodebaseIndex(sdk.ide.workspace_directory)

        yield SetStep(hide=False, description="Scanning codebase...")

        # Get top chunks from index
        to_retrieve_from_each = (
            (settings.n_retrieve if use_reranking else settings.n_final) or 25
        ) // 2

        # Use HyDE only if a faster model is available
        query = self.user_input
        keywords = None
        if faster_model is not None:
            resps = await asyncio.gather(
                *[
                    code_hyde(self.user_input, "", faster_model),
                    generate_keywords(self.user_input, faster_model),
                ]
            )
            query = resps[0]
            keywords = resps[1]

        # Get meilisearch chunks first, fill in the rest with chroma
        if keywords is None:
            meilisearch_chunks = await meilisearch_index.query(
                self.user_input, n=to_retrieve_from_each
            )
        else:
            meilisearch_chunks = await meilisearch_index.query_keywords(
                keywords, n=to_retrieve_from_each
            )
        chroma_chunks = await chroma_index.query(
            query, n=2 * to_retrieve_from_each - len(meilisearch_chunks)
        )

        chunk_ids = set()
        chunks = []
        for chunk in chroma_chunks + meilisearch_chunks:
            if chunk.id not in chunk_ids:
                chunk_ids.add(chunk.id)
                chunks.append(chunk)

        # Rerank to select top results
        yield SetStep(description="Selecting most important files...")

        if use_reranking:
            chunks = await single_token_reranker_parallel(
                chunks,
                self.user_input,
                settings.n_final or 10,
                faster_model,
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
                prompt=PROMPT.format(user_input=self.user_input),
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

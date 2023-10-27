import os
from typing import Coroutine, List, Optional, Union


from ...libs.llm.base import CompletionOptions
from ...libs.index.rerankers.default import default_reranker_parallel

from pydantic import Field

from ...core.main import (
    ContextItem,
    ContextItemDescription,
    ContextItemId,
    DeltaStep,
    SetStep,
    Step,
)
from ...core.sdk import ContinueSDK
from ...core.steps import EditFileStep
from ...libs.index.codebase_index import ChromaCodebaseIndex
from ..context_providers.util import remove_meilisearch_disallowed_chars
from .chat import SimpleChatStep


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

    async def run(self, sdk: ContinueSDK):
        index = ChromaCodebaseIndex(
            sdk.ide.workspace_directory,
            openai_api_key=self.openai_api_key,
            api_base=self.api_base,
            api_type=self.api_type,
            api_version=self.api_version,
            organization_id=self.organization_id,
        )
        if index.exists():
            return

        yield DeltaStep(hide=False)
        async for progress in index.build(sdk, ignore_files=self.ignore_files):
            yield SetStep(
                description=f"Generating codebase embeddings... {int(progress*100)}%",
            )


class AnswerQuestionChroma(Step):
    user_input: str
    _answer: Union[str, None] = None
    name: str = "Answer Question"

    n_retrieve: Optional[int] = Field(
        20, description="Number of results to initially retrieve from vector database"
    )
    n_final: Optional[int] = Field(
        10, description="Final number of results to use after re-ranking"
    )

    use_reranking: bool = Field(
        True,
        description="Whether to use re-ranking, which will allow initial selection of n_retrieve results, then will use an LLM to select the top n_final results",
    )

    hide: bool = True

    async def describe(self, llm) -> Coroutine[str, None, None]:
        if self._answer is None:
            return f"Answering the question: {self.user_input}"
        else:
            return self._answer

    async def run(self, sdk: ContinueSDK):
        index = ChromaCodebaseIndex(sdk.ide.workspace_directory)
        yield SetStep(hide=False, description="Scanning codebase...")

        # Get top chunks from index
        chunks = index.query(
            self.user_input, n=self.n_retrieve if self.use_reranking else self.n_final
        )

        # Rerank to select top results
        yield SetStep(description="Selecting most important files...")

        if self.use_reranking:
            chunks = await default_reranker_parallel(
                chunks, self.user_input, self.n_final, sdk
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

        yield DeltaStep(hide=True)

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

import os
from typing import Coroutine, Dict, List, Optional, Union
from ...libs.index.rerankers.default import default_reranker_parallel
from ...libs.util.strings import shorten_filepaths

from pydantic import Field

from ...core.main import ContextItem, ContextItemDescription, ContextItemId, Step
from ...core.observation import Observation
from ...core.sdk import ContinueSDK
from ...core.steps import EditFileStep
from ...libs.index.codebase_index import ChromaCodebaseIndex
from ..context_providers.util import remove_meilisearch_disallowed_chars
from .chat import SimpleChatStep
from ...core.steps import EditFileStep


class CreateCodebaseIndexChroma(Step):
    name: str = "Create Codebase Index"
    hide: bool = True
    description: str = "Generating codebase embeddings..."
    openai_api_key: Optional[str] = None

    ignore_files: List[str] = Field(
        [],
        description="Files to ignore when indexing the codebase. You can use glob patterns, such as **/*.py. This is useful for directories that contain generated code, or other directories that are not relevant to the codebase.",
    )

    async def describe(self, models) -> Coroutine[str, None, None]:
        return "Generated codebase embeddings."

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        index = ChromaCodebaseIndex(
            sdk.ide.workspace_directory,
            openai_api_key=self.openai_api_key,
        )
        if index.exists():
            return

        self.hide = False
        async for progress in index.build(sdk, ignore_files=self.ignore_files):
            self.description = f"Generating codebase embeddings... {int(progress*100)}%"
            await sdk.update_ui()


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

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        index = ChromaCodebaseIndex(sdk.ide.workspace_directory)
        self.description = f"Reading from {self.n_retrieve} files..."
        await sdk.update_ui()
        results = index.query_codebase_index(
            self.user_input, n=self.n_retrieve if self.use_reranking else self.n_final
        )

        shortened_filepaths = shorten_filepaths(results["ids"][0])
        results_dict = {
            filename: document
            for filename, document in zip(shortened_filepaths, results["documents"][0])
            if document.strip() != ""
        }

        if self.use_reranking:
            results_dict = await default_reranker_parallel(
                results_dict, self.user_input, self.n_final, sdk
            )

        filepaths = set([])
        context_items: List[ContextItem] = []
        for id, document in results_dict.items():
            filename = id.split("::")[0]
            filepath = results["ids"][0][shortened_filepaths.index(id)].split("::")[0]
            if filepath in filepaths:
                continue

            ctx_item = ContextItem(
                content=document,
                description=ContextItemDescription(
                    name=filename,
                    description=filepath,
                    id=ContextItemId(
                        provider_title="file",
                        item_id=remove_meilisearch_disallowed_chars(filepath),
                    ),
                ),
            )
            context_items.append(ctx_item)
            await sdk.add_context_item(ctx_item)
            filepaths.add(filepath)

        await sdk.update_ui()
        await sdk.run_step(
            SimpleChatStep(
                name="Answer Question",
                description=f"Reading from {self.n_final} files...",
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

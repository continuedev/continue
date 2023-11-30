import asyncio
from typing import Any, List, Union

from pydantic import Field

from ...core.main import ChatMessage
from .base import LLM, CompletionOptions


class QueuedLLM(LLM):
    """
    QueuedLLM exists to make up for LLM servers that cannot handle multiple requests at once. It uses a lock to ensure that only one request is being processed at a time.

    If you are already using another LLM class and are experiencing this problem, you can just wrap it with the QueuedLLM class like this:

    ```python title="~/.continue/config.py"
    from continuedev.libs.llm.queued import QueuedLLM

    config = ContinueConfig(
        ...
        models=Models(
            default=QueuedLLM(llm=<OTHER_LLM_CLASS>)
        )
    )
    ```
    """

    llm: LLM = Field(..., description="The LLM to wrap with a lock")
    _lock: asyncio.Lock

    model: str = "queued"

    def dict(self, **kwargs):
        return self.llm.dict(**kwargs)

    def start(self, *args, **kwargs):
        super().start(*args, **kwargs)
        self.llm.start(*args, **kwargs)
        self._lock = asyncio.Lock()
        self.model = self.llm.model
        self.template_messages = self.llm.template_messages
        self.prompt_templates = self.llm.prompt_templates
        self.context_length = self.llm.context_length

    async def stop(self):
        await self.llm.stop()

    def collect_args(self, options: CompletionOptions):
        return self.llm.collect_args(options)

    def compile_chat_messages(
        self,
        options: CompletionOptions,
        msgs: List[ChatMessage],
        functions: Union[List[Any], None] = None,
    ):
        return self.llm.compile_chat_messages(options, msgs, functions)

    def template_prompt_like_messages(self, prompt: str) -> str:
        return self.llm.template_prompt_like_messages(prompt)

    async def _complete(self, prompt: str, options: CompletionOptions):
        async with self._lock:
            resp = await self.llm._complete(prompt, options)
            return resp

    async def _stream_complete(self, prompt: str, options: CompletionOptions):
        async with self._lock:
            async for chunk in self.llm._stream_complete(prompt, options):
                yield chunk

    async def _stream_chat(
        self, messages: List[ChatMessage], options: CompletionOptions
    ):
        async with self._lock:
            async for chunk in self.llm._stream_chat(messages, options):
                yield chunk

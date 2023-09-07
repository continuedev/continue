import asyncio
from typing import Any, List

from ...core.main import ChatMessage
from . import LLM, CompletionOptions


class QueuedLLM(LLM):
    llm: LLM
    _lock: asyncio.Lock

    model: str = "queued"

    def dict(self, **kwargs):
        return self.llm.dict(**kwargs)

    async def start(self, *args, **kwargs):
        await super().start(*args, **kwargs)
        await self.llm.start(*args, **kwargs)
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
        functions: List[Any] | None = None,
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

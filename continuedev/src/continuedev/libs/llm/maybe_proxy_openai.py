from typing import Callable, List, Optional

from ...core.main import ChatMessage
from . import LLM
from .openai import OpenAI
from .proxy_server import ProxyServer


class MaybeProxyOpenAI(LLM):
    api_key: Optional[str] = None

    llm: Optional[LLM] = None

    def update_llm_properties(self):
        if self.llm is not None:
            self.llm.system_message = self.system_message

    async def start(
        self, write_log: Callable[[str], None] = None, unique_id: Optional[str] = None
    ):
        await super().start(write_log=write_log, unique_id=unique_id)
        if self.api_key is None or self.api_key.strip() == "":
            self.llm = ProxyServer(model=self.model)
        else:
            self.llm = OpenAI(api_key=self.api_key, model=self.model)

        await self.llm.start(write_log=write_log, unique_id=unique_id)

    async def stop(self):
        await self.llm.stop()

    async def _complete(self, prompt: str, options):
        self.update_llm_properties()
        return await self.llm._complete(prompt, options)

    async def _stream_complete(self, prompt, options):
        self.update_llm_properties()
        resp = self.llm._stream_complete(prompt, options)
        async for item in resp:
            yield item

    async def _stream_chat(self, messages: List[ChatMessage], options):
        self.update_llm_properties()
        resp = self.llm._stream_chat(messages=messages, options=options)
        async for item in resp:
            yield item

    def count_tokens(self, text: str):
        return self.llm.count_tokens(text)

from typing import Any, Coroutine, Dict, Generator, List, Optional, Union

from ...core.main import ChatMessage
from . import LLM
from .openai import OpenAI
from .proxy_server import ProxyServer


class MaybeProxyOpenAI(LLM):
    model: str
    api_key: Optional[str] = None

    llm: Optional[LLM] = None

    def update_llm_properties(self):
        if self.llm is not None:
            self.llm.system_message = self.system_message

    async def start(self, **kwargs):
        if self.api_key is None or self.api_key.strip() == "":
            self.llm = ProxyServer(model=self.model)
        else:
            self.llm = OpenAI(api_key=self.api_key, model=self.model)

        await self.llm.start(**kwargs)

    async def stop(self):
        await self.llm.stop()

    async def _complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ) -> Coroutine[Any, Any, str]:
        self.update_llm_properties()
        return await self.llm._complete(prompt, with_history=with_history, **kwargs)

    async def _stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        self.update_llm_properties()
        resp = self.llm._stream_complete(prompt, with_history=with_history, **kwargs)
        async for item in resp:
            yield item

    async def _stream_chat(
        self, messages: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        self.update_llm_properties()
        resp = self.llm._stream_chat(messages=messages, **kwargs)
        async for item in resp:
            yield item

    def count_tokens(self, text: str):
        return self.llm.count_tokens(text)

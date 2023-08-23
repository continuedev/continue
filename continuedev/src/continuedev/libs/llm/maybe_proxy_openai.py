from typing import Any, Callable, Coroutine, Dict, Generator, List, Optional, Union

from ...core.main import ChatMessage
from . import LLM
from .openai import OpenAI
from .proxy_server import ProxyServer


class MaybeProxyOpenAI(LLM):
    model: str
    api_key: Optional[str] = None

    requires_write_log: bool = True
    requires_unique_id: bool = True
    system_message: Union[str, None] = None

    llm: Optional[LLM] = None

    def update_llm_properties(self):
        if self.llm is not None:
            self.llm.system_message = self.system_message

    @property
    def name(self):
        if self.llm is not None:
            return self.llm.name
        else:
            return None

    @property
    def context_length(self):
        return self.llm.context_length

    async def start(
        self,
        *,
        api_key: Optional[str] = None,
        unique_id: str,
        write_log: Callable[[str], None]
    ):
        if self.api_key is None or self.api_key.strip() == "":
            self.llm = ProxyServer(model=self.model)
        else:
            self.llm = OpenAI(api_key=self.api_key, model=self.model)

        await self.llm.start(write_log=write_log, unique_id=unique_id)

    async def stop(self):
        await self.llm.stop()

    async def complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ) -> Coroutine[Any, Any, str]:
        self.update_llm_properties()
        return await self.llm.complete(prompt, with_history=with_history, **kwargs)

    async def stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        self.update_llm_properties()
        resp = self.llm.stream_complete(prompt, with_history=with_history, **kwargs)
        async for item in resp:
            yield item

    async def stream_chat(
        self, messages: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        self.update_llm_properties()
        resp = self.llm.stream_chat(messages=messages, **kwargs)
        async for item in resp:
            yield item

    def count_tokens(self, text: str):
        return self.llm.count_tokens(text)

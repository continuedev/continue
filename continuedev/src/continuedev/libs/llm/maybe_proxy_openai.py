from typing import Any, Coroutine, Dict, Generator, List, Union, Optional, Callable

from ...core.main import ChatMessage
from . import LLM
from .proxy_server import ProxyServer
from .openai import OpenAI


class MaybeProxyOpenAI(LLM):
    model: str

    requires_api_key: Optional[str] = "OPENAI_API_KEY"
    requires_write_log: bool = True
    system_message: Union[str, None] = None

    llm: Optional[LLM] = None

    @property
    def name(self):
        return self.llm.name

    @property
    def context_length(self):
        return self.llm.context_length

    async def start(self, *, api_key: Optional[str] = None, unique_id: str, write_log: Callable[[str], None]):
        if api_key is None or api_key.strip() == "":
            self.llm = ProxyServer(model=self.model)
        else:
            self.llm = OpenAI(model=self.model)

        await self.llm.start(api_key=api_key, write_log=write_log, unique_id=unique_id)

    async def stop(self):
        await self.llm.stop()

    async def complete(self, prompt: str, with_history: List[ChatMessage] = None, **kwargs) -> Coroutine[Any, Any, str]:
        return await self.llm.complete(prompt, with_history=with_history, **kwargs)

    async def stream_complete(self, prompt, with_history: List[ChatMessage] = None, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        resp = self.llm.stream_complete(
            prompt, with_history=with_history, **kwargs)
        async for item in resp:
            yield item

    async def stream_chat(self, messages: List[ChatMessage] = None, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        resp = self.llm.stream_chat(messages=messages, **kwargs)
        async for item in resp:
            yield item

    def count_tokens(self, text: str):
        return self.llm.count_tokens(text)

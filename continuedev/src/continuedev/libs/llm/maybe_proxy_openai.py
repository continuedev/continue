from typing import Any, Coroutine, Dict, Generator, List, Union, Optional

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

    async def start(self, *, api_key: Optional[str] = None, **kwargs):
        if api_key is None or api_key.strip() == "":
            self.llm = ProxyServer(
                unique_id="", model=self.model, write_log=kwargs["write_log"])
        else:
            self.llm = OpenAI(model=self.model, write_log=kwargs["write_log"])

        await self.llm.start(api_key=api_key, **kwargs)

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

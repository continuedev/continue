from functools import cached_property
import json
from typing import Any, Coroutine, Dict, Generator, List, Literal, Union
import aiohttp
from ...core.main import ChatMessage
from ..llm import LLM
from ..util.count_tokens import DEFAULT_ARGS, DEFAULT_MAX_TOKENS, compile_chat_messages, CHAT_MODELS, count_tokens

# SERVER_URL = "http://127.0.0.1:8080"
SERVER_URL = "https://proxy-server-l6vsfbzhba-uw.a.run.app"


class ProxyServer(LLM):
    unique_id: str
    name: str
    default_model: Literal["gpt-3.5-turbo", "gpt-4"]

    def __init__(self, unique_id: str, default_model: Literal["gpt-3.5-turbo", "gpt-4"], system_message: str = None):
        self.unique_id = unique_id
        self.default_model = default_model
        self.system_message = system_message
        self.name = default_model

    @property
    def default_args(self):
        return DEFAULT_ARGS | {"model": self.default_model}

    def count_tokens(self, text: str):
        return count_tokens(self.default_model, text)

    async def complete(self, prompt: str, with_history: List[ChatMessage] = [], **kwargs) -> Coroutine[Any, Any, str]:
        args = self.default_args | kwargs

        async with aiohttp.ClientSession() as session:
            async with session.post(f"{SERVER_URL}/complete", json={
                "messages": compile_chat_messages(args["model"], with_history, prompt, with_functions=False),
                "unique_id": self.unique_id,
                **args
            }) as resp:
                try:
                    return json.loads(await resp.text())
                except:
                    raise Exception(await resp.text())

    async def stream_chat(self, messages: List[ChatMessage] = [], **kwargs) -> Coroutine[Any, Any, Generator[Union[Any, List, Dict], None, None]]:
        args = self.default_args | kwargs
        messages = compile_chat_messages(
            self.default_model, messages, None, with_functions=args["model"].endswith("0613"))

        async with aiohttp.ClientSession() as session:
            async with session.post(f"{SERVER_URL}/stream_chat", json={
                "messages": messages,
                "unique_id": self.unique_id,
                **args
            }) as resp:
                # This is streaming application/json instaed of text/event-stream
                async for line in resp.content.iter_chunks():
                    if line[1]:
                        try:
                            json_chunk = line[0].decode("utf-8")
                            json_chunk = "{}" if json_chunk == "" else json_chunk
                            yield json.loads(json_chunk)
                        except:
                            raise Exception(str(line[0]))

    async def stream_complete(self, prompt, with_history: List[ChatMessage] = [], **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.default_args | kwargs
        messages = compile_chat_messages(
            self.default_model, with_history, prompt, with_functions=args["model"].endswith("0613"))

        async with aiohttp.ClientSession() as session:
            async with session.post(f"{SERVER_URL}/stream_complete", json={
                "messages": messages,
                "unique_id": self.unique_id,
                **args
            }) as resp:
                async for line in resp.content.iter_any():
                    if line:
                        try:
                            yield line.decode("utf-8")
                        except:
                            raise Exception(str(line))

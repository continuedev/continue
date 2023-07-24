from functools import cached_property
import json
from typing import Any, Coroutine, Dict, Generator, List, Union

import aiohttp
from ...core.main import ChatMessage
from ..llm import LLM
from ..util.count_tokens import compile_chat_messages, DEFAULT_ARGS, count_tokens

SERVER_URL = "http://localhost:8000"


class GGML(LLM):

    def __init__(self, system_message: str = None):
        self.system_message = system_message

    @cached_property
    def name(self):
        return "ggml"

    @property
    def default_args(self):
        return {**DEFAULT_ARGS, "model": self.name, "max_tokens": 1024}

    def count_tokens(self, text: str):
        return count_tokens(self.name, text)

    async def stream_complete(self, prompt, with_history: List[ChatMessage] = None, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.default_args.copy()
        args.update(kwargs)
        args["stream"] = True

        args = {**self.default_args, **kwargs}
        messages = compile_chat_messages(
            self.name, with_history, args["max_tokens"], prompt, functions=args.get("functions", None), system_message=self.system_message)

        async with aiohttp.ClientSession() as session:
            async with session.post(f"{SERVER_URL}/v1/completions", json={
                "messages": messages,
                **args
            }) as resp:
                async for line in resp.content.iter_any():
                    if line:
                        try:
                            yield line.decode("utf-8")
                        except:
                            raise Exception(str(line))

    async def stream_chat(self, messages: List[ChatMessage] = None, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        args = {**self.default_args, **kwargs}
        messages = compile_chat_messages(
            self.name, messages, args["max_tokens"], None, functions=args.get("functions", None), system_message=self.system_message)
        args["stream"] = True

        async with aiohttp.ClientSession() as session:
            async with session.post(f"{SERVER_URL}/v1/chat/completions", json={
                "messages": messages,
                **args
            }) as resp:
                # This is streaming application/json instaed of text/event-stream
                async for line in resp.content.iter_chunks():
                    if line[1]:
                        try:
                            json_chunk = line[0].decode("utf-8")
                            if json_chunk.startswith(": ping - ") or json_chunk.startswith("data: [DONE]"):
                                continue
                            chunks = json_chunk.split("\n")
                            for chunk in chunks:
                                if chunk.strip() != "":
                                    yield json.loads(chunk[6:])["choices"][0]["delta"]
                        except:
                            raise Exception(str(line[0]))

    async def complete(self, prompt: str, with_history: List[ChatMessage] = None, **kwargs) -> Coroutine[Any, Any, str]:
        args = {**self.default_args, **kwargs}

        async with aiohttp.ClientSession() as session:
            async with session.post(f"{SERVER_URL}/v1/completions", json={
                "messages": compile_chat_messages(args["model"], with_history, args["max_tokens"], prompt, functions=None, system_message=self.system_message),
                **args
            }) as resp:
                try:
                    return await resp.text()
                except:
                    raise Exception(await resp.text())

from functools import cached_property
import json
from typing import Any, Coroutine, Dict, Generator, List, Union

import aiohttp
from ...core.main import ChatMessage
import openai
from ..llm import LLM
from ..util.count_tokens import DEFAULT_MAX_TOKENS, compile_chat_messages, CHAT_MODELS, DEFAULT_ARGS, count_tokens, prune_raw_prompt_from_top
import certifi
import ssl

ca_bundle_path = certifi.where()
ssl_context = ssl.create_default_context(cafile=ca_bundle_path)

SERVER_URL = "http://localhost:8000"


class GGML(LLM):
    api_key: str
    default_model: str

    def __init__(self, api_key: str, default_model: str, system_message: str = None):
        self.api_key = api_key
        self.default_model = default_model
        self.system_message = system_message

        openai.api_key = api_key

    @cached_property
    def name(self):
        return self.default_model

    @property
    def default_args(self):
        return {**DEFAULT_ARGS, "model": self.default_model}

    def count_tokens(self, text: str):
        return count_tokens(self.default_model, text)

    async def stream_complete(self, prompt, with_history: List[ChatMessage] = [], **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.default_args.copy()
        args.update(kwargs)
        args["stream"] = True

        args = {**self.default_args, **kwargs}
        messages = compile_chat_messages(
            self.default_model, with_history, args["max_tokens"], prompt, functions=args.get("functions", None))

        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl_context=ssl_context)) as session:
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

    async def stream_chat(self, messages: List[ChatMessage] = [], **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        args = {**self.default_args, **kwargs}
        messages = compile_chat_messages(
            self.default_model, messages, args["max_tokens"], None, functions=args.get("functions", None))
        args["stream"] = True

        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl_context=ssl_context)) as session:
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
                            json_chunk = "{}" if json_chunk == "" else json_chunk
                            chunks = json_chunk.split("\n")
                            for chunk in chunks:
                                if chunk.strip() != "":
                                    yield json.loads(chunk[6:])["choices"][0]["delta"]
                        except:
                            raise Exception(str(line[0]))

    async def complete(self, prompt: str, with_history: List[ChatMessage] = [], **kwargs) -> Coroutine[Any, Any, str]:
        args = {**self.default_args, **kwargs}

        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl_context=ssl_context)) as session:
            async with session.post(f"{SERVER_URL}/v1/completions", json={
                "messages": compile_chat_messages(args["model"], with_history, args["max_tokens"], prompt, functions=None),
                **args
            }) as resp:
                try:
                    return await resp.text()
                except:
                    raise Exception(await resp.text())

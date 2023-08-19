import json
from typing import Any, Coroutine, Dict, Generator, List, Union

import aiohttp

from ...core.main import ChatMessage
from ..llm import LLM
from ..util.count_tokens import DEFAULT_ARGS, compile_chat_messages, count_tokens


class GGML(LLM):
    # this is model-specific
    max_context_length: int = 2048
    server_url: str = "http://localhost:8000"
    verify_ssl: bool = True

    _client_session: aiohttp.ClientSession = None

    class Config:
        arbitrary_types_allowed = True

    async def start(self, **kwargs):
        self._client_session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl)
        )

    async def stop(self):
        await self._client_session.close()

    @property
    def name(self):
        return "ggml"

    @property
    def context_length(self):
        return self.max_context_length

    @property
    def default_args(self):
        return {**DEFAULT_ARGS, "model": self.name, "max_tokens": 1024}

    def count_tokens(self, text: str):
        return count_tokens(self.name, text)

    async def stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.default_args.copy()
        args.update(kwargs)
        args["stream"] = True

        args = {**self.default_args, **kwargs}
        messages = compile_chat_messages(
            self.name,
            with_history,
            self.context_length,
            args["max_tokens"],
            prompt,
            functions=args.get("functions", None),
            system_message=self.system_message,
        )

        async with self._client_session.post(
            f"{self.server_url}/v1/completions", json={"messages": messages, **args}
        ) as resp:
            async for line in resp.content.iter_any():
                if line:
                    try:
                        yield line.decode("utf-8")
                    except:
                        raise Exception(str(line))

    async def stream_chat(
        self, messages: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = {**self.default_args, **kwargs}
        messages = compile_chat_messages(
            self.name,
            messages,
            self.context_length,
            args["max_tokens"],
            None,
            functions=args.get("functions", None),
            system_message=self.system_message,
        )
        args["stream"] = True

        async with self._client_session.post(
            f"{self.server_url}/v1/chat/completions",
            json={"messages": messages, **args},
        ) as resp:
            # This is streaming application/json instaed of text/event-stream
            async for line, end in resp.content.iter_chunks():
                if end:
                    continue

                json_chunk = line.decode("utf-8")
                if json_chunk.startswith(": ping - ") or json_chunk.startswith(
                    "data: [DONE]"
                ):
                    continue
                chunks = json_chunk.split("\n")
                for chunk in chunks:
                    if chunk.strip() != "":
                        yield json.loads(chunk[6:])["choices"][0][
                            "delta"
                        ]  # {"role": "assistant", "content": "..."}

    async def complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ) -> Coroutine[Any, Any, str]:
        args = {**self.default_args, **kwargs}

        async with self._client_session.post(
            f"{self.server_url}/v1/completions",
            json={
                "messages": compile_chat_messages(
                    args["model"],
                    with_history,
                    self.context_length,
                    args["max_tokens"],
                    prompt,
                    functions=None,
                    system_message=self.system_message,
                ),
                **args,
            },
        ) as resp:
            return json.loads(await resp.text())["choices"][0]["text"]

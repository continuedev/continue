import json
from typing import Any, Coroutine, Dict, Generator, List, Optional, Union

import aiohttp

from ...core.main import ChatMessage
from ..llm import LLM
from ..util.count_tokens import DEFAULT_ARGS, compile_chat_messages, count_tokens


class TogetherLLM(LLM):
    # this is model-specific
    api_key: str
    model: str = "togethercomputer/RedPajama-INCITE-7B-Instruct"
    max_context_length: int = 2048
    base_url: str = "https://api.together.xyz"
    verify_ssl: Optional[bool] = None

    _client_session: aiohttp.ClientSession = None

    async def start(self, **kwargs):
        self._client_session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl)
        )

    async def stop(self):
        await self._client_session.close()

    @property
    def name(self):
        return self.model

    @property
    def context_length(self):
        return self.max_context_length

    @property
    def default_args(self):
        return {**DEFAULT_ARGS, "model": self.model, "max_tokens": 1024}

    def count_tokens(self, text: str):
        return count_tokens(self.name, text)

    def convert_to_prompt(self, chat_messages: List[ChatMessage]) -> str:
        system_message = None
        if chat_messages[0]["role"] == "system":
            system_message = chat_messages.pop(0)["content"]

        prompt = "\n"
        if system_message:
            prompt += f"<human>: Hi!\n<bot>: {system_message}\n"
        for message in chat_messages:
            prompt += f'<{"human" if message["role"] == "user" else "bot"}>: {message["content"]}\n'

        prompt += "<bot>:"
        return prompt

    async def stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.default_args.copy()
        args.update(kwargs)
        args["stream_tokens"] = True

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
            f"{self.base_url}/inference",
            json={"prompt": self.convert_to_prompt(messages), **args},
            headers={"Authorization": f"Bearer {self.api_key}"},
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
        args["stream_tokens"] = True

        async with self._client_session.post(
            f"{self.base_url}/inference",
            json={"prompt": self.convert_to_prompt(messages), **args},
            headers={"Authorization": f"Bearer {self.api_key}"},
        ) as resp:
            async for line in resp.content.iter_chunks():
                if line[1]:
                    json_chunk = line[0].decode("utf-8")
                    if json_chunk.startswith(": ping - ") or json_chunk.startswith(
                        "data: [DONE]"
                    ):
                        continue

                    chunks = json_chunk.split("\n")
                    for chunk in chunks:
                        if chunk.strip() != "":
                            if chunk.startswith("data: "):
                                chunk = chunk[6:]
                            json_chunk = json.loads(chunk)
                            if "choices" in json_chunk:
                                yield {
                                    "role": "assistant",
                                    "content": json_chunk["choices"][0]["text"],
                                }

    async def complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ) -> Coroutine[Any, Any, str]:
        args = {**self.default_args, **kwargs}

        messages = compile_chat_messages(
            args["model"],
            with_history,
            self.context_length,
            args["max_tokens"],
            prompt,
            functions=None,
            system_message=self.system_message,
        )
        async with self._client_session.post(
            f"{self.base_url}/inference",
            json={"prompt": self.convert_to_prompt(messages), **args},
            headers={"Authorization": f"Bearer {self.api_key}"},
        ) as resp:
            try:
                text = await resp.text()
                j = json.loads(text)
                if "choices" not in j["output"]:
                    raise Exception(text)
                if "output" in j:
                    return j["output"]["choices"][0]["text"]
            except:
                raise Exception(await resp.text())

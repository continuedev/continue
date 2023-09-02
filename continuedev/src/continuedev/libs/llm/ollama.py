import json
import urllib.parse
from textwrap import dedent
from typing import Any, Coroutine, Dict, Generator, List, Union

import aiohttp

from ...core.main import ChatMessage
from ..llm import LLM
from ..util.count_tokens import compile_chat_messages
from .prompts.chat import llama2_template_messages


class Ollama(LLM):
    model: str = "llama2"
    server_url: str = "http://localhost:11434"

    _client_session: aiohttp.ClientSession = None

    prompt_templates = {
        "edit": dedent(
            """\
            [INST] Consider the following code:
            ```
            {{code_to_edit}}
            ```
            Edit the code to perfectly satisfy the following user request:
            {{user_input}}
            Output nothing except for the code. No code block, no English explanation, no start/end tags.
            [/INST]"""
        ),
    }

    class Config:
        arbitrary_types_allowed = True

    async def start(self, **kwargs):
        await super().start(**kwargs)
        self._client_session = aiohttp.ClientSession()

    async def stop(self):
        await self._client_session.close()

    async def _stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.collect_args(**kwargs)
        messages = compile_chat_messages(
            self.model,
            with_history,
            self.context_length,
            args["max_tokens"],
            prompt,
            functions=None,
            system_message=self.system_message,
        )
        prompt = llama2_template_messages(messages)

        async with self._client_session.post(
            f"{self.server_url}/api/generate",
            json={
                "template": prompt,
                "model": self.model,
                "system": self.system_message,
                "options": {"temperature": args["temperature"]},
            },
        ) as resp:
            url_decode_buffer = ""
            async for line in resp.content.iter_any():
                if line:
                    json_chunk = line.decode("utf-8")
                    chunks = json_chunk.split("\n")
                    for chunk in chunks:
                        if chunk.strip() != "":
                            j = json.loads(chunk)
                            if "response" in j:
                                url_decode_buffer += j["response"]

                                if (
                                    "&" in url_decode_buffer
                                    and url_decode_buffer.index("&")
                                    > len(url_decode_buffer) - 5
                                ):
                                    continue
                                yield urllib.parse.unquote(url_decode_buffer)
                                url_decode_buffer = ""

    async def _stream_chat(
        self, messages: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.collect_args(**kwargs)
        messages = compile_chat_messages(
            self.model,
            messages,
            self.context_length,
            args["max_tokens"],
            None,
            functions=None,
            system_message=self.system_message,
        )
        prompt = llama2_template_messages(messages)

        self.write_log(f"Prompt:\n{prompt}")
        completion = ""
        async with self._client_session.post(
            f"{self.server_url}/api/generate",
            json={
                "template": prompt,
                "model": self.model,
                "system": self.system_message,
                "options": {"temperature": args["temperature"]},
            },
        ) as resp:
            async for line in resp.content.iter_chunks():
                if line[1]:
                    json_chunk = line[0].decode("utf-8")
                    chunks = json_chunk.split("\n")
                    for chunk in chunks:
                        if chunk.strip() != "":
                            j = json.loads(chunk)
                            if "response" in j:
                                yield {
                                    "role": "assistant",
                                    "content": j["response"],
                                }
                                completion += j["response"]
        self.write_log(f"Completion:\n{completion}")

    async def _complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ) -> Coroutine[Any, Any, str]:
        completion = ""
        args = self.collect_args(**kwargs)
        async with self._client_session.post(
            f"{self.server_url}/api/generate",
            json={
                "template": prompt,
                "model": self.model,
                "system": self.system_message,
                "options": {"temperature": args["temperature"]},
            },
        ) as resp:
            async for line in resp.content.iter_any():
                if line:
                    json_chunk = line.decode("utf-8")
                    chunks = json_chunk.split("\n")
                    for chunk in chunks:
                        if chunk.strip() != "":
                            j = json.loads(chunk)
                            if "response" in j:
                                completion += urllib.parse.unquote(j["response"])

        return completion

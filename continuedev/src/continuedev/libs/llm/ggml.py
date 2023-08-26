import json
from typing import Any, Callable, Coroutine, Dict, Generator, List, Optional, Union

import aiohttp

from ...core.main import ChatMessage
from ..llm import LLM
from ..util.count_tokens import (
    DEFAULT_ARGS,
    compile_chat_messages,
    count_tokens,
    format_chat_messages,
)


class GGML(LLM):
    # this is model-specific
    max_context_length: int = 2048
    server_url: str = "http://localhost:8000"
    verify_ssl: Optional[bool] = None

    requires_write_log = True

    write_log: Optional[Callable[[str], None]] = None

    class Config:
        arbitrary_types_allowed = True

    async def start(self, write_log: Callable[[str], None], **kwargs):
        self.write_log = write_log

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

        self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")
        completion = ""
        async with aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl)
        ) as client_session:
            async with client_session.post(
                f"{self.server_url}/v1/completions", json={"messages": messages, **args}
            ) as resp:
                async for line in resp.content.iter_any():
                    if line:
                        try:
                            chunk = line.decode("utf-8")
                            yield chunk
                            completion += chunk
                        except:
                            raise Exception(str(line))

        self.write_log(f"Completion: \n\n{completion}")

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

        async def generator():
            async with aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl)
            ) as client_session:
                async with client_session.post(
                    f"{self.server_url}/v1/chat/completions",
                    json={"messages": messages, **args},
                ) as resp:
                    # This is streaming application/json instaed of text/event-stream
                    async for line, end in resp.content.iter_chunks():
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

        # Because quite often the first attempt fails, and it works thereafter
        self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")
        completion = ""
        try:
            async for chunk in generator():
                yield chunk
                if "content" in chunk:
                    completion += chunk["content"]
        except:
            async for chunk in generator():
                yield chunk
                if "content" in chunk:
                    completion += chunk["content"]

        self.write_log(f"Completion: \n\n{completion}")

    async def complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ) -> Coroutine[Any, Any, str]:
        args = {**self.default_args, **kwargs}

        # messages = compile_chat_messages(
        #     args["model"],
        #     with_history,
        #     self.context_length,
        #     args["max_tokens"],
        #     prompt,
        #     functions=None,
        #     system_message=self.system_message,
        # )

        self.write_log(f"Prompt: \n\n{prompt}")
        async with aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl)
        ) as client_session:
            async with client_session.post(
                f"{self.server_url}/v1/completions",
                json={
                    "prompt": prompt,
                    **args,
                },
            ) as resp:
                text = await resp.text()
                completion = json.loads(text)["choices"][0]["text"]
                self.write_log(f"Completion: \n\n{completion}")
                return completion

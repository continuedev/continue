from functools import cached_property
import json
from typing import Any, Coroutine, Dict, Generator, List, Union

import aiohttp
from ...core.main import ChatMessage
from ..llm import LLM
from ..util.count_tokens import compile_chat_messages, DEFAULT_ARGS, count_tokens


class Ollama(LLM):
    model: str = "llama2"
    server_url: str = "http://localhost:11434"
    max_context_length: int

    @cached_property
    def name(self):
        return self.model

    @property
    def default_args(self):
        return {**DEFAULT_ARGS, "model": self.name, "max_tokens": 1024}

    def count_tokens(self, text: str):
        return count_tokens(self.name, text)

    def convert_to_chat(self, msgs: ChatMessage) -> str:
        if len(msgs) == 0:
            return ""

        prompt = ""
        has_system = msgs[0].role == "system"
        if has_system:
            system_message = f"""\
                <<SYS>>
                {self.system_message}
                <</SYS>>
                
                """
            if len(msgs) > 1:
                prompt += f"[INST] {system_message}{msgs[1].content} [/INST]"
            else:
                prompt += f"[INST] {system_message} [/INST]"
                return

        for i in range(2 if has_system else 0, len(msgs)):
            if msgs[i].role == "user":
                prompt += f"[INST] {msgs[i].content} [/INST]"
            else:
                prompt += msgs[i].content

        return prompt

    async def stream_complete(self, prompt, with_history: List[ChatMessage] = None, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        messages = compile_chat_messages(
            self.name, with_history, self.max_context_length, prompt, system_message=self.system_message)
        prompt = self.convert_to_chat(messages)

        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self.server_urlL}/api/generate", json={
                "prompt": prompt,
                "model": self.model,
            }) as resp:
                async for line in resp.content.iter_any():
                    if line:
                        try:
                            j = json.dumps(line.decode("utf-8"))
                            yield j["response"]
                            if j["done"]:
                                break
                        except:
                            raise Exception(str(line))

    async def stream_chat(self, messages: List[ChatMessage] = None, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        messages = compile_chat_messages(
            self.name, messages, self.max_context_length, prompt, system_message=self.system_message)
        prompt = self.convert_to_chat(messages)

        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self.server_urlL}/api/generate", json={
                "prompt": prompt,
                "model": self.model,
            }) as resp:
                # This is streaming application/json instaed of text/event-stream
                async for line in resp.content.iter_chunks():
                    if line[1]:
                        try:
                            j = json.dumps(line.decode("utf-8"))
                            yield {
                                "role": "assistant",
                                "content": j["response"]
                            }
                            if j["done"]:
                                break
                        except:
                            raise Exception(str(line[0]))

    async def complete(self, prompt: str, with_history: List[ChatMessage] = None, **kwargs) -> Coroutine[Any, Any, str]:
        completion = ""

        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self.server_urlL}/api/generate", json={
                "prompt": prompt,
                "model": self.model,
            }) as resp:
                async for line in resp.content.iter_any():
                    if line:
                        try:
                            j = json.dumps(line.decode("utf-8"))
                            completion += j["response"]
                            if j["done"]:
                                break
                        except:
                            raise Exception(str(line))

        return completion

import json
from typing import Any, Coroutine, List, Optional

import aiohttp

from ...core.main import ChatMessage
from ..llm import LLM
from ..util.logging import logger
from .prompts.edit import simplified_edit_prompt


class GGML(LLM):
    server_url: str = "http://localhost:8000"
    verify_ssl: Optional[bool] = None
    model: str = "ggml"

    prompt_templates = {
        "edit": simplified_edit_prompt,
    }

    class Config:
        arbitrary_types_allowed = True

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)

        async with aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl),
            timeout=aiohttp.ClientTimeout(total=self.timeout),
        ) as client_session:
            async with client_session.post(
                f"{self.server_url}/v1/completions",
                json={
                    "prompt": prompt,
                    "stream": True,
                    **args,
                },
            ) as resp:
                async for line in resp.content.iter_any():
                    if line:
                        chunk = line.decode("utf-8")
                        if chunk.startswith(": ping - ") or chunk.startswith(
                            "data: [DONE]"
                        ):
                            continue
                        elif chunk.startswith("data: "):
                            chunk = chunk[6:]

                        j = json.loads(chunk)
                        if "choices" in j:
                            yield j["choices"][0]["text"]

    async def _stream_chat(self, messages: List[ChatMessage], options):
        args = self.collect_args(options)

        async def generator():
            async with aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl),
                timeout=aiohttp.ClientTimeout(total=self.timeout),
            ) as client_session:
                async with client_session.post(
                    f"{self.server_url}/v1/chat/completions",
                    json={"messages": messages, "stream": True, **args},
                    headers={"Content-Type": "application/json"},
                ) as resp:
                    async for line, end in resp.content.iter_chunks():
                        json_chunk = line.decode("utf-8")
                        chunks = json_chunk.split("\n")
                        for chunk in chunks:
                            if (
                                chunk.strip() == ""
                                or json_chunk.startswith(": ping - ")
                                or json_chunk.startswith("data: [DONE]")
                            ):
                                continue
                            try:
                                yield json.loads(chunk[6:])["choices"][0]["delta"]
                            except:
                                pass

        # Because quite often the first attempt fails, and it works thereafter
        try:
            async for chunk in generator():
                yield chunk
        except Exception as e:
            logger.warning(f"Error calling /chat/completions endpoint: {e}")
            async for chunk in generator():
                yield chunk

    async def _complete(self, prompt: str, options) -> Coroutine[Any, Any, str]:
        args = self.collect_args(options)

        async with aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl),
            timeout=aiohttp.ClientTimeout(total=self.timeout),
        ) as client_session:
            async with client_session.post(
                f"{self.server_url}/v1/completions",
                json={
                    "prompt": prompt,
                    **args,
                },
            ) as resp:
                text = await resp.text()
                try:
                    completion = json.loads(text)["choices"][0]["text"]
                    return completion
                except Exception as e:
                    raise Exception(
                        f"Error calling /completion endpoint: {e}\n\nResponse text: {text}"
                    )

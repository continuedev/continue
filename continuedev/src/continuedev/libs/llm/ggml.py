import json
import ssl
from typing import Any, Callable, Coroutine, Dict, List, Optional

import aiohttp
from pydantic import Field

from ...core.main import ChatMessage
from ..llm import LLM
from ..util.logging import logger
from . import CompletionOptions
from .openai import CHAT_MODELS
from .prompts.chat import llama2_template_messages
from .prompts.edit import simplified_edit_prompt


class GGML(LLM):
    """
    See our [5 minute quickstart](https://github.com/continuedev/ggml-server-example) to run any model locally with ggml. While these models don't yet perform as well, they are free, entirely private, and run offline.

    Once the model is running on localhost:8000, change `~/.continue/config.py` to look like this:

    ```python
    from continuedev.src.continuedev.libs.llm.ggml import GGML

    config = ContinueConfig(
        ...
        models=Models(
            default=GGML(
                max_context_length=2048,
                server_url="http://localhost:8000")
        )
    )
    ```
    """

    server_url: str = Field(
        "http://localhost:8000",
        description="URL of the OpenAI-compatible server where the model is being served",
    )
    proxy: Optional[str] = Field(
        None,
        description="Proxy URL to use when making the HTTP request",
    )
    model: str = Field(
        "ggml", description="The name of the model to use (optional for the GGML class)"
    )

    template_messages: Optional[
        Callable[[List[Dict[str, str]]], str]
    ] = llama2_template_messages

    prompt_templates = {
        "edit": simplified_edit_prompt,
    }

    class Config:
        arbitrary_types_allowed = True

    def create_client_session(self):
        if self.ca_bundle_path is None:
            ssl_context = ssl.create_default_context(cafile=self.ca_bundle_path)
            tcp_connector = aiohttp.TCPConnector(
                verify_ssl=self.verify_ssl, ssl=ssl_context
            )
        else:
            tcp_connector = aiohttp.TCPConnector(verify_ssl=self.verify_ssl)

        return aiohttp.ClientSession(
            connector=tcp_connector,
            timeout=aiohttp.ClientTimeout(total=self.timeout),
        )

    def get_headers(self):
        headers = {
            "Content-Type": "application/json",
        }
        if self.api_key is not None:
            headers["Authorization"] = f"Bearer {self.api_key}"

        return headers

    async def _raw_stream_complete(self, prompt, options):
        args = self.collect_args(options)

        async with self.create_client_session() as client_session:
            async with client_session.post(
                f"{self.server_url}/v1/completions",
                json={
                    "prompt": prompt,
                    "stream": True,
                    **args,
                },
                headers=self.get_headers(),
                proxy=self.proxy,
            ) as resp:
                async for line in resp.content.iter_any():
                    if line:
                        chunks = line.decode("utf-8")
                        for chunk in chunks.split("\n"):
                            if (
                                chunk.startswith(": ping - ")
                                or chunk.startswith("data: [DONE]")
                                or chunk.strip() == ""
                            ):
                                continue
                            elif chunk.startswith("data: "):
                                chunk = chunk[6:]
                            try:
                                j = json.loads(chunk)
                            except Exception:
                                continue
                            if (
                                "choices" in j
                                and len(j["choices"]) > 0
                                and "text" in j["choices"][0]
                            ):
                                yield j["choices"][0]["text"]

    async def _stream_chat(self, messages: List[ChatMessage], options):
        args = self.collect_args(options)

        async def generator():
            async with self.create_client_session() as client_session:
                async with client_session.post(
                    f"{self.server_url}/v1/chat/completions",
                    json={"messages": messages, "stream": True, **args},
                    headers=self.get_headers(),
                    proxy=self.proxy,
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

    async def _raw_complete(self, prompt: str, options) -> Coroutine[Any, Any, str]:
        args = self.collect_args(options)

        async with self.create_client_session() as client_session:
            async with client_session.post(
                f"{self.server_url}/v1/completions",
                json={
                    "prompt": prompt,
                    **args,
                },
                headers=self.get_headers(),
                proxy=self.proxy,
            ) as resp:
                text = await resp.text()
                try:
                    completion = json.loads(text)["choices"][0]["text"]
                    return completion
                except Exception as e:
                    raise Exception(
                        f"Error calling /completion endpoint: {e}\n\nResponse text: {text}"
                    )

    async def _complete(self, prompt: str, options: CompletionOptions):
        completion = ""
        if self.model in CHAT_MODELS:
            async for chunk in self._stream_chat(
                [{"role": "user", "content": prompt}], options
            ):
                if "content" in chunk:
                    completion += chunk["content"]

        else:
            async for chunk in self._raw_stream_complete(prompt, options):
                completion += chunk

        return completion

    async def _stream_complete(self, prompt, options: CompletionOptions):
        if self.model in CHAT_MODELS:
            async for chunk in self._stream_chat(
                [{"role": "user", "content": prompt}], options
            ):
                if "content" in chunk:
                    yield chunk["content"]

        else:
            async for chunk in self._raw_stream_complete(prompt, options):
                yield chunk

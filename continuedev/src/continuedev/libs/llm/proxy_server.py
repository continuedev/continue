import json
import ssl
import traceback
from typing import List

import aiohttp
import certifi

from ...core.main import ChatMessage
from ..llm import LLM
from ..util.telemetry import posthog_logger

# SERVER_URL = "http://127.0.0.1:8080"
SERVER_URL = "https://proxy-server-l6vsfbzhba-uw.a.run.app"

MAX_TOKENS_FOR_MODEL = {
    "gpt-3.5-turbo": 4096,
    "gpt-3.5-turbo-0613": 4096,
    "gpt-3.5-turbo-16k": 16384,
    "gpt-4": 8192,
}


class ProxyServer(LLM):
    _client_session: aiohttp.ClientSession

    class Config:
        arbitrary_types_allowed = True

    async def start(
        self,
        **kwargs,
    ):
        await super().start(**kwargs)
        if self.verify_ssl is False:
            self._client_session = aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(verify_ssl=False),
                timeout=aiohttp.ClientTimeout(total=self.timeout),
            )
        else:
            ca_bundle_path = (
                certifi.where() if self.ca_bundle_path is None else self.ca_bundle_path
            )
            ssl_context = ssl.create_default_context(cafile=ca_bundle_path)
            self._client_session = aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(ssl_context=ssl_context),
                timeout=aiohttp.ClientTimeout(total=self.timeout),
            )

        self.context_length = MAX_TOKENS_FOR_MODEL[self.model]

    async def stop(self):
        await self._client_session.close()

    def get_headers(self):
        return {"unique_id": self.unique_id}

    async def _complete(self, prompt: str, options):
        args = self.collect_args(options)

        async with self._client_session.post(
            f"{SERVER_URL}/complete",
            json={"messages": [{"role": "user", "content": prompt}], **args},
            headers=self.get_headers(),
        ) as resp:
            resp_text = await resp.text()
            if resp.status != 200:
                raise Exception(resp_text)

            return resp_text

    async def _stream_chat(self, messages: List[ChatMessage], options):
        args = self.collect_args(options)
        async with self._client_session.post(
            f"{SERVER_URL}/stream_chat",
            json={"messages": messages, **args},
            headers=self.get_headers(),
        ) as resp:
            if resp.status != 200:
                raise Exception(await resp.text())

            async for line in resp.content.iter_chunks():
                if line[1]:
                    try:
                        json_chunk = line[0].decode("utf-8")
                        json_chunk = "{}" if json_chunk == "" else json_chunk
                        chunks = json_chunk.split("\n")
                        for chunk in chunks:
                            if chunk.strip() != "":
                                loaded_chunk = json.loads(chunk)
                                yield loaded_chunk

                    except Exception as e:
                        posthog_logger.capture_event(
                            "proxy_server_parse_error",
                            {
                                "error_title": "Proxy server stream_chat parsing failed",
                                "error_message": "\n".join(
                                    traceback.format_exception(e)
                                ),
                            },
                        )
                else:
                    break

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)

        async with self._client_session.post(
            f"{SERVER_URL}/stream_complete",
            json={"messages": [{"role": "user", "content": prompt}], **args},
            headers=self.get_headers(),
        ) as resp:
            if resp.status != 200:
                raise Exception(await resp.text())

            async for line in resp.content.iter_any():
                if line:
                    decoded_line = line.decode("utf-8")
                    yield decoded_line

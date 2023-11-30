import asyncio
import json
from typing import List

from pydantic import validator

from ...core.main import ChatMessage
from ..util.count_tokens import CONTEXT_LENGTH_FOR_MODEL
from ..util.errors import format_exc
from ..util.telemetry import posthog_logger
from .base import LLM

# SERVER_URL = "http://127.0.0.1:8080"
SERVER_URL = "https://proxy-server-l6vsfbzhba-uw.a.run.app"


class ProxyServer(LLM):
    class Config:
        arbitrary_types_allowed = True

    def start(
        self,
        **kwargs,
    ):
        super().start(**kwargs)
        self.context_length = CONTEXT_LENGTH_FOR_MODEL[self.model]

    def get_headers(self):
        return {"unique_id": self.unique_id}

    @validator("context_length")
    def context_length_for_model(cls, v, values):
        return CONTEXT_LENGTH_FOR_MODEL.get(values["model"], 4096)

    async def _complete(self, prompt: str, options):
        args = self.collect_args(options)

        async with self.create_client_session() as session:
            async with session.post(
                f"{SERVER_URL}/complete",
                json={"messages": [{"role": "user", "content": prompt}], **args},
                headers=self.get_headers(),
                proxy=self.request_options.proxy,
            ) as resp:
                resp_text = await resp.text()
                if resp.status != 200:
                    raise Exception(resp_text)

                return resp_text

    async def _stream_chat(self, messages: List[ChatMessage], options):
        args = self.collect_args(options)
        async with self.create_client_session() as session:
            async with session.post(
                f"{SERVER_URL}/stream_chat",
                json={"messages": [msg.to_dict() for msg in messages], **args},
                headers=self.get_headers(),
                proxy=self.request_options.proxy,
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
                                    yield ChatMessage(
                                        role="assistant",
                                        content=loaded_chunk.get("content", ""),
                                    )

                                    if self.model == "gpt-4":
                                        await asyncio.sleep(0.03)
                                    else:
                                        await asyncio.sleep(0.01)

                        except Exception as e:
                            posthog_logger.capture_event(
                                "proxy_server_parse_error",
                                {
                                    "error_title": "Proxy server stream_chat parsing failed",
                                    "error_message": format_exc(e),
                                },
                            )
                    else:
                        break

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)

        async with self.create_client_session() as session:
            async with session.post(
                f"{SERVER_URL}/stream_complete",
                json={"messages": [{"role": "user", "content": prompt}], **args},
                headers=self.get_headers(),
                proxy=self.request_options.proxy,
            ) as resp:
                if resp.status != 200:
                    raise Exception(await resp.text())

                async for line in resp.content.iter_any():
                    if line:
                        decoded_line = line.decode("utf-8")
                        yield decoded_line

from typing import Callable, List, Literal, Optional

import certifi
import openai

from ...core.main import ChatMessage
from ..llm import LLM

CHAT_MODELS = {
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k",
    "gpt-4",
    "gpt-3.5-turbo-0613",
    "gpt-4-32k",
}
MAX_TOKENS_FOR_MODEL = {
    "gpt-3.5-turbo": 4096,
    "gpt-3.5-turbo-0613": 4096,
    "gpt-3.5-turbo-16k": 16_384,
    "gpt-4": 8192,
    "gpt-35-turbo-16k": 16_384,
    "gpt-35-turbo-0613": 4096,
    "gpt-35-turbo": 4096,
    "gpt-4-32k": 32_768,
}


class OpenAI(LLM):
    api_key: str
    "OpenAI API key"

    verify_ssl: Optional[bool] = None
    "Whether to verify SSL certificates for requests."

    ca_bundle_path: Optional[str] = None
    "Path to CA bundle to use for requests."

    proxy: Optional[str] = None
    "Proxy URL to use for requests."

    api_base: Optional[str] = None
    "OpenAI API base URL."

    api_type: Optional[Literal["azure", "openai"]] = None
    "OpenAI API type."

    api_version: Optional[str] = None
    "OpenAI API version. For use with Azure OpenAI Service."

    engine: Optional[str] = None
    "OpenAI engine. For use with Azure OpenAI Service."

    async def start(
        self, unique_id: Optional[str] = None, write_log: Callable[[str], None] = None
    ):
        await super().start(write_log=write_log, unique_id=unique_id)

        self.context_length = MAX_TOKENS_FOR_MODEL.get(self.model, 4096)

        openai.api_key = self.api_key
        if self.api_type is not None:
            openai.api_type = self.api_type
        if self.api_base is not None:
            openai.api_base = self.api_base
        if self.api_version is not None:
            openai.api_version = self.api_version

        if self.verify_ssl is not None and self.verify_ssl is False:
            openai.verify_ssl_certs = False

        if self.proxy is not None:
            openai.proxy = self.proxy

        openai.ca_bundle_path = self.ca_bundle_path or certifi.where()

    def collect_args(self, options):
        args = super().collect_args(options)
        if self.engine is not None:
            args["engine"] = self.engine

        if not args["model"].endswith("0613") and "functions" in args:
            del args["functions"]

        return args

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)
        args["stream"] = True

        if args["model"] in CHAT_MODELS:
            async for chunk in await openai.ChatCompletion.acreate(
                messages=[{"role": "user", "content": prompt}],
                **args,
            ):
                if "content" in chunk.choices[0].delta:
                    yield chunk.choices[0].delta.content
        else:
            async for chunk in await openai.Completion.acreate(prompt=prompt, **args):
                yield chunk.choices[0].text

    async def _stream_chat(self, messages: List[ChatMessage], options):
        args = self.collect_args(options)

        async for chunk in await openai.ChatCompletion.acreate(
            messages=messages,
            stream=True,
            **args,
        ):
            if len(chunk.choices) == 0:
                continue
            yield chunk.choices[0].delta

    async def _complete(self, prompt: str, options):
        args = self.collect_args(options)

        if args["model"] in CHAT_MODELS:
            resp = await openai.ChatCompletion.acreate(
                messages=[{"role": "user", "content": prompt}],
                **args,
            )
            return resp.choices[0].message.content
        else:
            return (
                (await openai.Completion.acreate(prompt=prompt, **args)).choices[0].text
            )

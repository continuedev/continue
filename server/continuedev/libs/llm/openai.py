import asyncio
from typing import AsyncGenerator, List, Literal, Optional

import certifi
import openai
from openai.error import RateLimitError
from pydantic import Field, validator

from ...core.main import ChatMessage
from ..util.count_tokens import CONTEXT_LENGTH_FOR_MODEL
from ..util.logging import logger
from .base import LLM
from .prompts.chat import template_alpaca_messages

CHAT_MODELS = {
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k",
    "gpt-4",
    "gpt-3.5-turbo-0613",
    "gpt-4-32k",
    "gpt-4-1106-preview",
}
NON_CHAT_MODELS = {
    "gpt-3.5-turbo-instruct",
    "text-davinci-003",
    "text-davinci-002",
    "code-davinci-002",
    "babbage-002",
    "davinci-002",
    "text-curie-001",
    "text-babbage-001",
    "text-ada-001",
    "davinci",
    "curie",
    "babbage",
    "ada",
}


class OpenAI(LLM):
    """
    The OpenAI class can be used to access OpenAI models like gpt-4 and gpt-3.5-turbo.

    If you are locally serving a model that uses an OpenAI-compatible server, you can simply change the `api_base` like this:

    ```json title="~/.continue/config.json"
    {
        "models": [{
            "title": "OpenAI-compatible server",
            "provider": "openai",
            "model": "MODEL_NAME",
            "api_key": "EMPTY",
            "api_base": "http://localhost:8000"
        }]
    }
    ```

    Options for serving models locally with an OpenAI-compatible server include:

    - [text-gen-webui](https://github.com/oobabooga/text-generation-webui/tree/main/extensions/openai#setup--installation)
    - [FastChat](https://github.com/lm-sys/FastChat/blob/main/docs/openai_api.md)
    - [LocalAI](https://localai.io/basics/getting_started/)
    - [llama-cpp-python](https://github.com/abetlen/llama-cpp-python#web-server)
    """

    api_key: str = Field(
        ...,
        description="OpenAI API key",
    )

    api_base: Optional[str] = Field(default=None, description="OpenAI API base URL.")

    api_type: Optional[Literal["azure", "openai"]] = Field(
        default=None, description="OpenAI API type."
    )

    api_version: Optional[str] = Field(
        default=None,
        description="OpenAI API version. For use with Azure OpenAI Service.",
    )

    engine: Optional[str] = Field(
        default=None, description="OpenAI engine. For use with Azure OpenAI Service."
    )

    use_legacy_completions_endpoint: bool = Field(
        default=False,
        description="Manually specify to use the legacy completions endpoint instead of chat completions.",
    )

    @validator("context_length")
    def context_length_for_model(cls, v, values):
        return CONTEXT_LENGTH_FOR_MODEL.get(values["model"], 4096)

    def start(self, unique_id: Optional[str] = None):
        super().start(unique_id=unique_id)

        if self.context_length is None:
            self.context_length = CONTEXT_LENGTH_FOR_MODEL.get(self.model, 4096)

        openai.api_key = self.api_key
        if self.api_type is not None:
            openai.api_type = self.api_type
        if self.api_base is not None:
            openai.api_base = self.api_base
        if self.api_version is not None:
            openai.api_version = self.api_version

        if (
            self.request_options.verify_ssl is not None
            and self.request_options.verify_ssl is False
        ):
            openai.verify_ssl_certs = False

        if self.request_options.proxy is not None:
            openai.proxy = self.request_options.proxy

        openai.ca_bundle_path = self.request_options.ca_bundle_path or certifi.where()

        session = self.create_client_session()
        openai.aiosession.set(session)

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

        if (
            args["model"] not in NON_CHAT_MODELS
            and not self.use_legacy_completions_endpoint
        ):
            async for chunk in await openai.ChatCompletion.acreate(
                messages=[{"role": "user", "content": prompt}],
                **args,
                headers=self.request_options.headers,
            ):
                if len(chunk.choices) > 0 and "content" in chunk.choices[0].delta:
                    yield chunk.choices[0].delta.content
        else:
            async for chunk in await openai.Completion.acreate(
                prompt=prompt, **args, headers=self.request_options.headers
            ):
                if len(chunk.choices) > 0:
                    yield chunk.choices[0].text

    async def _stream_chat(
        self, messages: List[ChatMessage], options
    ) -> AsyncGenerator[ChatMessage, None]:
        args = self.collect_args(options)

        if (
            args["model"] not in NON_CHAT_MODELS
            and not self.use_legacy_completions_endpoint
        ):
            async for chunk in await openai.ChatCompletion.acreate(
                messages=[msg.to_dict() for msg in messages],
                stream=True,
                **args,
                headers=self.request_options.headers,
            ):
                if not hasattr(chunk, "choices") or len(chunk.choices) == 0:
                    continue

                delta = chunk.choices[0].delta
                if self.api_type == "azure":
                    if self.model == "gpt-4":
                        await asyncio.sleep(0.03)
                    else:
                        await asyncio.sleep(0.01)

                yield ChatMessage(role="assistant", content=delta.get("content", ""))

        else:
            async for chunk in await openai.Completion.acreate(
                prompt=template_alpaca_messages(messages),
                stream=True,
                **args,
                headers=self.request_options.headers,
            ):
                if len(chunk.choices) > 0:
                    ChatMessage(role="assistant", content=chunk.choices[0].text)

    async def _complete(self, prompt: str, options):
        args = self.collect_args(options)

        if (
            args["model"] not in NON_CHAT_MODELS
            and not self.use_legacy_completions_endpoint
        ):
            wait_time = 0.2
            while True:
                try:
                    resp = await openai.ChatCompletion.acreate(
                        messages=[{"role": "user", "content": prompt}],
                        **args,
                        headers=self.request_options.headers,
                    )
                    return resp.choices[0].message.content
                except RateLimitError as e:
                    logger.debug(f"Rate limit exceeded, waiting {wait_time} seconds")
                    await asyncio.sleep(wait_time)
                    wait_time *= 2
                    if wait_time > 2**10:
                        raise e
        else:
            return (
                (
                    await openai.Completion.acreate(
                        prompt=prompt, **args, headers=self.request_options.headers
                    )
                )
                .choices[0]
                .text
            )

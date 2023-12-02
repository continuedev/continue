import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator, List, Literal, Optional

import httpx
import litellm
from litellm import acompletion
from pydantic import Field, validator

from ...core.main import ChatMessage
from ..util.count_tokens import CONTEXT_LENGTH_FOR_MODEL
from .base import LLM

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
    The OpenAI class can be used to access OpenAI models like GPT-4, GPT-4 Turbo, and GPT-3.5 Turbo.

    ### Azure OpenAI Service

    If you'd like to use OpenAI models but are concerned about privacy, you can use the Azure OpenAI service, which is GDPR and HIPAA compliant. After applying for access [here](https://azure.microsoft.com/en-us/products/ai-services/openai-service), you will typically hear back within only a few days. Once you have access, set up a model in `config.json` like so:

    ```json
    "models": [{
        "title": "Azure OpenAI",
        "provider": "openai",
        "model": "gpt-4",
        "api_base": "https://my-azure-openai-instance.openai.azure.com/",
        "engine": "my-azure-openai-deployment",
        "api_version": "2023-07-01-preview",
        "api_type": "azure",
        "api_key": "<MY_API_KEY>"
    }]
    ```

    The easiest way to find this information is from the chat playground in the Azure OpenAI portal. Under the "Chat Session" section, click "View Code" to see each of these parameters.

    ### OpenAI compatible servers / APIs

    OpenAI compatible servers
    - [text-gen-webui](https://github.com/oobabooga/text-generation-webui/tree/main/extensions/openai#setup--installation)
    - [FastChat](https://github.com/lm-sys/FastChat/blob/main/docs/openai_api.md)
    - [LocalAI](https://localai.io/basics/getting_started/)
    - [llama-cpp-python](https://github.com/abetlen/llama-cpp-python#web-server)

    OpenAI compatible APIs
    - [Anyscale Endpoints](https://github.com/continuedev/deploy-os-code-llm#others)
    - [Anyscale Private Endpoints](https://github.com/continuedev/deploy-os-code-llm#anyscale-private-endpoints)

    If you are [using an OpenAI compatible server / API](../../model-setup/select-provider#local), you can change the `api_base` like this:

    ```json title="~/.continue/config.json"
    {
        "models": [{
            "title": "OpenAI-compatible server / API",
            "provider": "openai",
            "model": "MODEL_NAME",
            "api_key": "EMPTY",
            "api_base": "http://localhost:8000"
        }]
    }
    ```
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

    def collect_args(self, options):
        args = super().collect_args(options)
        if self.api_type == "azure":
            assert self.engine is not None, "engine must be specified for Azure API"
            args["model"] = f"azure/{self.engine}"
            args["api_version"] = self.api_version

        args["api_key"] = self.api_key
        args["api_base"] = self.api_base

        if not args["model"].endswith("0613") and "functions" in args:
            del args["functions"]

        return args

    def httpx_client(self) -> httpx.AsyncClient:
        args = {}
        if timeout := self.request_options.timeout:
            args["timeout"] = httpx.Timeout(timeout)

        if verify_ssl := self.request_options.verify_ssl:
            args["verify"] = verify_ssl

        if ca_bundle_path := self.request_options.ca_bundle_path:
            args["cert"] = ca_bundle_path

        if proxy := self.request_options.proxy:
            args["proxies"] = {"https": proxy, "http": proxy}

        if headers := self.request_options.headers:
            args["headers"] = headers

        return httpx.AsyncClient(**args)

    @asynccontextmanager
    async def httpx_client_context(self):
        client = self.httpx_client()
        litellm.aclient_session = client
        try:
            yield
        finally:
            await client.aclose()

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)

        async with self.httpx_client_context():
            resp = await acompletion(
                messages=[{"content": prompt, "role": "user"}],
                **args,
                stream=True,
            )
            async for chunk in resp:
                if chunk.choices[0].delta.content is None:
                    continue

                yield chunk.choices[0].delta.content

    async def _stream_chat(
        self, messages: List[ChatMessage], options
    ) -> AsyncGenerator[ChatMessage, None]:
        args = self.collect_args(options)
        # and not self.use_legacy_completions_endpoint
        # headers=self.request_options.headers,
        # resp = await acompletion(
        #     messages=[msg.to_dict() for msg in messages],
        #     **args,
        #     api_base=self.api_base,
        #     api_version=self.api_version,
        #     # engine=self.engine,
        #     api_key=self.api_key,
        #     custom_llm_provider="azure" if self.api_type == "azure" else None,
        # )

        async with self.httpx_client_context():
            resp = await acompletion(
                messages=[msg.to_dict() for msg in messages],
                **args,
                stream=True,
            )
            async for chunk in resp:
                if len(chunk.choices) == 0:
                    continue  # :)

                if self.api_type == "azure":
                    if self.model == "gpt-4":
                        await asyncio.sleep(0.03)
                    else:
                        await asyncio.sleep(0.01)

                yield ChatMessage(
                    role="assistant", content=chunk.choices[0].delta.content or ""
                )

    async def _complete(self, prompt: str, options):
        args = self.collect_args(options)

        async with self.httpx_client_context():
            resp = await acompletion(
                messages=[{"content": prompt, "role": "user"}],
                **args,
            )

            return resp.choices[0].message.content

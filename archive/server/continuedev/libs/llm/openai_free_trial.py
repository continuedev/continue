from typing import List, Optional

from pydantic import Field, validator

from ...core.main import ChatMessage
from ...models.llm import RequestOptions
from ..util.count_tokens import CONTEXT_LENGTH_FOR_MODEL
from .base import LLM
from .openai import OpenAI
from .proxy_server import ProxyServer


class OpenAIFreeTrial(LLM):
    """
    With the `OpenAIFreeTrial` `LLM`, new users can try out Continue with GPT-4 using a proxy server that securely makes calls to OpenAI using our API key. Continue should just work the first time you install the extension in VS Code.

    Once you are using Continue regularly though, you will need to add an OpenAI API key that has access to GPT-4 by following these steps:

    1. Copy your API key from https://platform.openai.com/account/api-keys
    2. Open `~/.continue/config.json`. You can do this by using the '/config' command in Continue
    3. Change the default LLMs to look like this:

    ```json title="~/.continue/config.json"
    {
        "models": [
            {
                "title": "GPT-4",
                "provider": "openai",
                "model": "gpt-4",
                "api_key": "YOUR_API_KEY"
            },
            {
                "title": "GPT-3.5-Turbo",
                "provider": "openai",
                "model": "gpt-3.5-turbo",
                "api_key": "YOUR_API_KEY"
            }
        ],
        "model_roles": {
            "default": "GPT-4",
            "summarize": "GPT-3.5-Turbo"
        }
    }
    ```
    """

    llm: LLM = Field(default=None, description="The LLM to use for completion.")

    @validator("llm", pre=True, always=True)
    def set_llm(cls, llm, values):
        api_key = values.get("api_key")
        if api_key is None or api_key.strip() == "":
            return ProxyServer(
                model=values["model"],
                request_options=RequestOptions(
                    timeout=values["request_options"].timeout,
                    verify_ssl=values["request_options"].verify_ssl,
                ),
            )
        else:
            return OpenAI(
                api_key=api_key,
                model=values["model"],
                request_options=RequestOptions(
                    timeout=values["request_options"].timeout,
                    verify_ssl=values["request_options"].verify_ssl,
                ),
            )

    @validator("context_length", pre=True, always=True)
    def context_length_for_model(cls, v, values):
        return CONTEXT_LENGTH_FOR_MODEL.get(values["model"], 4096)

    def update_llm_properties(self):
        self.llm.system_message = self.system_message

    def start(self, unique_id: Optional[str] = None):
        super().start(unique_id=unique_id)
        self.llm.start(unique_id=unique_id)

    async def stop(self):
        await self.llm.stop()

    async def _complete(self, prompt: str, options):
        self.update_llm_properties()
        return await self.llm._complete(prompt, options)

    async def _stream_complete(self, prompt, options):
        self.update_llm_properties()
        resp = self.llm._stream_complete(prompt, options)
        async for item in resp:
            yield item

    async def _stream_chat(self, messages: List[ChatMessage], options):
        self.update_llm_properties()
        resp = self.llm._stream_chat(messages=messages, options=options)
        async for item in resp:
            yield item

    def count_tokens(self, text: str):
        return self.llm.count_tokens(text)

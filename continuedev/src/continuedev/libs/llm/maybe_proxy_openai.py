from typing import Callable, List, Optional

from ...core.main import ChatMessage
from . import LLM
from .openai import OpenAI
from .proxy_server import ProxyServer


class MaybeProxyOpenAI(LLM):
    """
    With the `MaybeProxyOpenAI` `LLM`, new users can try out Continue with GPT-4 using a proxy server that securely makes calls to OpenAI using our API key. Continue should just work the first time you install the extension in VS Code.

    Once you are using Continue regularly though, you will need to add an OpenAI API key that has access to GPT-4 by following these steps:

    1. Copy your API key from https://platform.openai.com/account/api-keys
    2. Open `~/.continue/config.py`. You can do this by using the '/config' command in Continue
    3. Change the default LLMs to look like this:

    ```python
    API_KEY = "<API_KEY>"
    config = ContinueConfig(
        ...
        models=Models(
            default=MaybeProxyOpenAI(model="gpt-4", api_key=API_KEY),
            medium=MaybeProxyOpenAI(model="gpt-3.5-turbo", api_key=API_KEY)
        )
    )
    ```

    The `MaybeProxyOpenAI` class will automatically switch to using your API key instead of ours. If you'd like to explicitly use one or the other, you can use the `ProxyServer` or `OpenAI` classes instead.

    These classes support any models available through the OpenAI API, assuming your API key has access, including "gpt-4", "gpt-3.5-turbo", "gpt-3.5-turbo-16k", and "gpt-4-32k".
    """

    api_key: Optional[str] = None

    llm: Optional[LLM] = None

    def update_llm_properties(self):
        if self.llm is not None:
            self.llm.system_message = self.system_message

    async def start(
        self, write_log: Callable[[str], None] = None, unique_id: Optional[str] = None
    ):
        await super().start(write_log=write_log, unique_id=unique_id)
        if self.api_key is None or self.api_key.strip() == "":
            self.llm = ProxyServer(
                model=self.model,
                verify_ssl=self.verify_ssl,
                ca_bundle_path=self.ca_bundle_path,
            )
        else:
            self.llm = OpenAI(
                api_key=self.api_key,
                model=self.model,
                verify_ssl=self.verify_ssl,
                ca_bundle_path=self.ca_bundle_path,
            )

        await self.llm.start(write_log=write_log, unique_id=unique_id)

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

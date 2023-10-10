import json
from typing import Callable

import aiohttp
from pydantic import Field

from ...core.main import ContinueCustomException
from ..util.logging import logger
from .base import LLM
from .prompts.chat import llama2_template_messages
from .prompts.edit import simplified_edit_prompt


class Ollama(LLM):
    """
    [Ollama](https://ollama.ai/) is an application for Mac and Linux that makes it easy to locally run open-source models, including Llama-2. Download the app from the website, and it will walk you through setup in a couple of minutes. You can also read more in their [README](https://github.com/jmorganca/ollama). Continue can then be configured to use the `Ollama` LLM class:

    ```python title="~/.continue/config.py"
    from continuedev.libs.llm.ollama import Ollama

    config = ContinueConfig(
        ...
        models=Models(
            default=Ollama(model="llama2")
        )
    )
    ```
    """

    model: str = "llama2"
    server_url: str = Field(
        "http://localhost:11434", description="URL of the Ollama server"
    )

    _client_session: aiohttp.ClientSession = None

    template_messages: Callable = llama2_template_messages

    prompt_templates = {
        "edit": simplified_edit_prompt,
    }

    class Config:
        arbitrary_types_allowed = True

    async def start(self, **kwargs):
        await super().start(**kwargs)
        self._client_session = self.create_client_session()
        try:
            async with self._client_session.post(
                f"{self.server_url}/api/generate",
                proxy=self.proxy,
                json={
                    "prompt": "",
                    "model": self.model,
                },
            ) as _:
                pass
        except Exception as e:
            logger.warning(f"Error pre-loading Ollama model: {e}")

    async def stop(self):
        await self._client_session.close()

    async def get_downloaded_models(self):
        async with self._client_session.get(
            f"{self.server_url}/api/tags",
            proxy=self.proxy,
        ) as resp:
            js_data = await resp.json()
            return list(map(lambda x: x["name"], js_data["models"]))

    async def _stream_complete(self, prompt, options):
        async with self._client_session.post(
            f"{self.server_url}/api/generate",
            json={
                "template": prompt,
                "model": self.model,
                "system": self.system_message,
                "options": {"temperature": options.temperature},
            },
            proxy=self.proxy,
        ) as resp:
            if resp.status == 400:
                txt = await resp.text()
                extra_msg = ""
                if "no such file" in txt:
                    extra_msg = f"\n\nThis means that the model '{self.model}' is not downloaded.\n\nYou have the following models downloaded: {', '.join(await self.get_downloaded_models())}.\n\nTo download this model, run `ollama run {self.model}` in your terminal."
                raise ContinueCustomException(
                    f"Ollama returned an error: {txt}{extra_msg}",
                    "Invalid request to Ollama",
                )
            elif resp.status != 200:
                raise ContinueCustomException(
                    f"Ollama returned an error: {await resp.text()}",
                    "Invalid request to Ollama",
                )
            async for line in resp.content.iter_any():
                if line:
                    json_chunk = line.decode("utf-8")
                    chunks = json_chunk.split("\n")
                    for chunk in chunks:
                        if chunk.strip() != "":
                            j = json.loads(chunk)
                            if "response" in j:
                                yield j["response"]

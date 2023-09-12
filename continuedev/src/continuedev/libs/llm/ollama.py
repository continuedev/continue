import json
from typing import Callable

import aiohttp
from pydantic import Field

from ..llm import LLM
from .prompts.chat import llama2_template_messages
from .prompts.edit import simplified_edit_prompt


class Ollama(LLM):
    """
    [Ollama](https://ollama.ai/) is a Mac application that makes it easy to locally run open-source models, including Llama-2. Download the app from the website, and it will walk you through setup in a couple of minutes. You can also read more in their [README](https://github.com/jmorganca/ollama). Continue can then be configured to use the `Ollama` LLM class:

    ```python
    from continuedev.src.continuedev.libs.llm.ollama import Ollama

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
        self._client_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        )

    async def stop(self):
        await self._client_session.close()

    async def _stream_complete(self, prompt, options):
        async with self._client_session.post(
            f"{self.server_url}/api/generate",
            json={
                "template": prompt,
                "model": self.model,
                "system": self.system_message,
                "options": {"temperature": options.temperature},
            },
        ) as resp:
            async for line in resp.content.iter_any():
                if line:
                    json_chunk = line.decode("utf-8")
                    chunks = json_chunk.split("\n")
                    for chunk in chunks:
                        if chunk.strip() != "":
                            j = json.loads(chunk)
                            if "response" in j:
                                yield j["response"]

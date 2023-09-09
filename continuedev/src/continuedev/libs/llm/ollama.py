import json
from typing import Callable

import aiohttp

from ..llm import LLM
from .prompts.chat import llama2_template_messages
from .prompts.edit import simplified_edit_prompt


class Ollama(LLM):
    model: str = "llama2"
    server_url: str = "http://localhost:11434"

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

import json
from typing import Any, Dict, Optional

import requests
from pydantic import Field, validator

from ...core.main import ContinueCustomException
from ..util.logging import logger
from .base import LLM, CompletionOptions


class Ollama(LLM):
    """
    [Ollama](https://ollama.ai/) is an application for Mac and Linux that makes it easy to locally run open-source models, including Llama-2. Download the app from the website, and it will walk you through setup in a couple of minutes. You can also read more in their [README](https://github.com/jmorganca/ollama). Continue can then be configured to use the `Ollama` LLM class:

    ```json title="~/.continue/config.json"
    {
        "models": [{
            "title": "Ollama",
            "provider": "ollama",
            "model": "llama2-7b",
        }]
    }
    ```
    """

    model: str = "llama2"
    api_base: Optional[str] = Field(
        "http://localhost:11434", description="URL of the Ollama server"
    )

    @validator("api_base", pre=True, always=True)
    def set_api_base(cls, api_base):
        return api_base or "http://localhost:11434"

    class Config:
        arbitrary_types_allowed = True

    def collect_args(self, options: CompletionOptions) -> Dict[str, Any]:
        return {
            "temperature": options.temperature,
            "top_p": options.top_p,
            "top_k": options.top_k,
            "num_predict": options.max_tokens,
            "stop": options.stop,
            "num_ctx": self.context_length,
        }

    def get_model_name(self):
        return {
            "mistral-7b": "mistral:7b",
            "llama2-7b": "llama2:7b",
            "llama2-13b": "llama2:13b",
            "codellama-7b": "codellama:7b",
            "codellama-13b": "codellama:13b",
            "codellama-34b": "codellama:34b",
            "phind-codellama-34b": "phind-codellama:34b-v2",
            "wizardcoder-7b": "wizardcoder:7b-python",
            "wizardcoder-13b": "wizardcoder:13b-python",
            "wizardcoder-34b": "wizardcoder:34b-python",
            "zephyr-7b": "zephyr:7b",
            "codeup-13b": "codeup:13b",
        }.get(self.model, self.model)

    def start(self, *args, **kwargs):
        super().start(*args, **kwargs)
        try:
            requests.post(
                f"{self.api_base}/api/generate",
                json={
                    "prompt": "",
                    "model": self.get_model_name(),
                },
            )
        except Exception as e:
            logger.warning(f"Error pre-loading Ollama model: {e}")

    async def get_downloaded_models(self):
        async with self.create_client_session() as session:
            async with session.get(
                f"{self.api_base}/api/tags",
                proxy=self.request_options.proxy,
            ) as resp:
                js_data = await resp.json()
                return list(map(lambda x: x["name"], js_data["models"]))

    async def _stream_complete(self, prompt, options):
        async with self.create_client_session() as session:
            async with session.post(
                f"{self.api_base}/api/generate",
                json={
                    "prompt": prompt,
                    "raw": True,
                    "model": self.get_model_name(),
                    "options": self.collect_args(options),
                },
                proxy=self.request_options.proxy,
            ) as resp:
                if resp.status == 400:
                    txt = await resp.text()
                    extra_msg = ""
                    if "no such file" in txt:
                        extra_msg = f"\n\nThis means that the model '{self.get_model_name()}' is not downloaded.\n\nYou have the following models downloaded: {', '.join(await self.get_downloaded_models())}.\n\nTo download this model, run `ollama run {self.get_model_name()}` in your terminal."
                    raise ContinueCustomException(
                        f"Ollama returned an error: {txt}{extra_msg}",
                        "Invalid request to Ollama",
                    )
                elif resp.status == 404:
                    model_name = self.get_model_name()
                    raise ContinueCustomException(
                        f"Ollama returned 404. Make sure the server is running and '{model_name}' is downloaded with `ollama run {model_name}`.\n\n{await resp.text()}",
                        f"Ollama returned 404. Make sure the server is running and '{model_name}' is downloaded with `ollama run {model_name}`.",
                    )
                elif resp.status != 200:
                    raise ContinueCustomException(
                        f"Ollama returned an error: {await resp.text()}",
                        f"Ollama returned an error: {await resp.text()}",
                    )
                async for line in resp.content.iter_any():
                    if line:
                        json_chunk = line.decode("utf-8")
                        chunks = json_chunk.split("\n")
                        for chunk in chunks:
                            if chunk.strip() != "":
                                try:
                                    j = json.loads(chunk)
                                except Exception as e:
                                    logger.warning(
                                        f"Error parsing Ollama response: {e} {chunk}"
                                    )
                                    continue
                                if "response" in j:
                                    yield j["response"]

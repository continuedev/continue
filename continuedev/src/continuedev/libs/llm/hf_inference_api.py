from typing import Any, Coroutine, Dict, Generator, List, Optional, Union
import aiohttp
import requests

from ...core.main import ChatMessage
from ..util.count_tokens import DEFAULT_ARGS, count_tokens
from ...core.main import ChatMessage
from ..llm import LLM

DEFAULT_MAX_TIME = 120.


class HuggingFaceInferenceAPI(LLM):
    model: str
    hf_token: str

    max_context_length: int = 2048
    verify_ssl: bool = True

    _client_session: aiohttp.ClientSession = None

    class Config:
        arbitrary_types_allowed = True

    async def start(self, **kwargs):
        self._client_session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl))

    async def stop(self):
        await self._client_session.close()

    @property
    def name(self):
        return self.model

    @property
    def context_length(self):
        return self.max_context_length

    @property
    def default_args(self):
        return {**DEFAULT_ARGS, "model": self.name, "max_tokens": 1024}

    def count_tokens(self, text: str):
        return count_tokens(self.name, text)

    async def complete(self, prompt: str, with_history: List[ChatMessage] = None, **kwargs):
        """Return the completion of the text with the given temperature."""
        API_URL = f"https://api-inference.huggingface.co/models/{self.model}"
        headers = {
            "Authorization": f"Bearer {self.hf_token}"}

        response = requests.post(API_URL, headers=headers, json={
            "inputs": prompt, "parameters": {
                "max_new_tokens": self.max_context_length - self.count_tokens(prompt),
                "max_time": DEFAULT_MAX_TIME,
                "return_full_text": False,
            }
        })
        data = response.json()

        # Error if the response is not a list
        if not isinstance(data, list):
            raise Exception(
                "Hugging Face returned an error response: \n\n", data)

        return data[0]["generated_text"]

    async def stream_chat(self, messages: List[ChatMessage] = None, **kwargs) -> Coroutine[Any, Any, Generator[Any | List | Dict, None, None]]:
        response = await self.complete(messages[-1].content, messages[:-1])
        yield {
            "content": response,
            "role": "assistant"
        }

    async def stream_complete(self, prompt, with_history: List[ChatMessage] = None, **kwargs) -> Generator[Any | List | Dict, None, None]:
        response = await self.complete(prompt, with_history)
        yield response

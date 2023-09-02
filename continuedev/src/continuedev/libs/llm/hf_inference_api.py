from typing import Any, Coroutine, Dict, Generator, List, Optional

import aiohttp
import requests

from ...core.main import ChatMessage
from ..llm import LLM

DEFAULT_MAX_TIME = 120.0


class HuggingFaceInferenceAPI(LLM):
    hf_token: str
    self_hosted_url: str = None

    verify_ssl: Optional[bool] = None

    _client_session: aiohttp.ClientSession = None

    class Config:
        arbitrary_types_allowed = True

    async def start(self, **kwargs):
        await super().start(**kwargs)
        self._client_session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl)
        )

    async def stop(self):
        await self._client_session.close()

    async def _complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ):
        """Return the completion of the text with the given temperature."""
        API_URL = (
            self.base_url or f"https://api-inference.huggingface.co/models/{self.model}"
        )
        headers = {"Authorization": f"Bearer {self.hf_token}"}

        response = requests.post(
            API_URL,
            headers=headers,
            json={
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": min(
                        250, self.max_context_length - self.count_tokens(prompt)
                    ),
                    "max_time": DEFAULT_MAX_TIME,
                    "return_full_text": False,
                },
            },
        )
        data = response.json()

        # Error if the response is not a list
        if not isinstance(data, list):
            raise Exception("Hugging Face returned an error response: \n\n", data)

        return data[0]["generated_text"]

    async def _stream_chat(
        self, messages: List[ChatMessage] = None, **kwargs
    ) -> Coroutine[Any, Any, Generator[Any | List | Dict, None, None]]:
        response = await self._complete(messages[-1].content, messages[:-1])
        yield {"content": response, "role": "assistant"}

    async def _stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ) -> Generator[Any | List | Dict, None, None]:
        response = await self._complete(prompt, with_history)
        yield response

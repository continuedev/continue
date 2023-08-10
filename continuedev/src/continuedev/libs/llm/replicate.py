from abc import abstractproperty
from typing import List, Optional
import replicate
import concurrent.futures

from ..util.count_tokens import DEFAULT_ARGS, count_tokens
from ...core.main import ChatMessage
from . import LLM


class ReplicateLLM(LLM):
    api_key: str
    model: str = "nateraw/stablecode-completion-alpha-3b-4k:e82ebe958f0a5be6846d1a82041925767edb1d1f162596c643e48fbea332b1bb"
    max_context_length: int = 2048

    _client: replicate.Client = None

    @property
    def name(self):
        return self.model

    @property
    def context_length(self):
        return self.max_context_length

    @property
    def default_args(self):
        return {**DEFAULT_ARGS, "model": self.model, "max_tokens": 1024}

    def count_tokens(self, text: str):
        return count_tokens(self.name, text)

    async def start(self):
        self._client = replicate.Client(api_token=self.api_key)

    async def stop(self):
        pass

    async def complete(self, prompt: str, with_history: List[ChatMessage] = None, **kwargs):
        def helper():
            output = self._client.run(self.model, input={"message": prompt})
            completion = ''
            for item in output:
                completion += item

            return completion

        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(helper)
            completion = future.result()

        return completion

    async def stream_complete(self, prompt, with_history: List[ChatMessage] = None, **kwargs):
        for item in self._client.run(self.model, input={"message": prompt}):
            yield item

    async def stream_chat(self, messages: List[ChatMessage] = None, **kwargs):
        for item in self._client.run(self.model, input={"message": messages[-1].content}):
            yield {
                "content": item,
                "role": "assistant"
            }

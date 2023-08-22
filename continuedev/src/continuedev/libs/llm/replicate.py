import concurrent.futures
from typing import List

import replicate

from ...core.main import ChatMessage
from ..util.count_tokens import DEFAULT_ARGS, count_tokens
from . import LLM


class ReplicateLLM(LLM):
    api_key: str
    model: str = "replicate/llama-2-70b-chat:58d078176e02c219e11eb4da5a02a7830a283b14cf8f94537af893ccff5ee781"
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

    async def complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ):
        def helper():
            output = self._client.run(
                self.model, input={"message": prompt, "prompt": prompt}
            )
            completion = ""
            for item in output:
                completion += item

            return completion

        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(helper)
            completion = future.result()

        return completion

    async def stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ):
        for item in self._client.run(
            self.model, input={"message": prompt, "prompt": prompt}
        ):
            yield item

    async def stream_chat(self, messages: List[ChatMessage] = None, **kwargs):
        for item in self._client.run(
            self.model,
            input={"message": messages[-1].content, "prompt": messages[-1].content},
        ):
            yield {"content": item, "role": "assistant"}

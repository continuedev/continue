import concurrent.futures
from typing import List

import replicate

from ...core.main import ChatMessage
from . import LLM


class ReplicateLLM(LLM):
    api_key: str
    "Replicate API key"

    model: str = "replicate/llama-2-70b-chat:58d078176e02c219e11eb4da5a02a7830a283b14cf8f94537af893ccff5ee781"

    _client: replicate.Client = None

    async def start(self, **kwargs):
        await super().start(**kwargs)
        self._client = replicate.Client(api_token=self.api_key)

    async def _complete(
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

    async def _stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ):
        for item in self._client.run(
            self.model, input={"message": prompt, "prompt": prompt}
        ):
            yield item

    async def _stream_chat(self, messages: List[ChatMessage] = None, **kwargs):
        for item in self._client.run(
            self.model,
            input={"message": messages[-1].content, "prompt": messages[-1].content},
        ):
            yield {"content": item, "role": "assistant"}

import concurrent.futures
from typing import List

import replicate

from ...core.main import ChatMessage
from . import LLM
from .prompts.edit import simplified_edit_prompt


class ReplicateLLM(LLM):
    api_key: str
    "Replicate API key"

    model: str = "replicate/llama-2-70b-chat:58d078176e02c219e11eb4da5a02a7830a283b14cf8f94537af893ccff5ee781"

    _client: replicate.Client = None

    prompt_templates = {
        "edit": simplified_edit_prompt,
    }

    async def start(self, **kwargs):
        await super().start(**kwargs)
        self._client = replicate.Client(api_token=self.api_key)

    async def _complete(self, prompt: str, options):
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

    async def _stream_complete(self, prompt, options):
        for item in self._client.run(
            self.model, input={"message": prompt, "prompt": prompt}
        ):
            yield item

    async def _stream_chat(self, messages: List[ChatMessage], options):
        for item in self._client.run(
            self.model,
            input={
                "message": messages[-1]["content"],
                "prompt": messages[-1]["content"],
            },
        ):
            yield {"content": item, "role": "assistant"}

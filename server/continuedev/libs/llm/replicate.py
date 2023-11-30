import concurrent.futures
from typing import List

import replicate
from pydantic import Field

from ...core.main import ChatMessage
from .base import LLM


class ReplicateLLM(LLM):
    """
    Replicate is a great option for newly released language models or models that you've deployed through their platform. Sign up for an account [here](https://replicate.ai/), copy your API key, and then select any model from the [Replicate Streaming List](https://replicate.com/collections/streaming-language-models). Change `~/.continue/config.json` to look like this:

    ```json title="~/.continue/config.json"
    {
        "models": [{
            "title": "Replicate CodeLLama",
            "provider": "replicate",
            "model": "codellama-13b",
            "api_key": "YOUR_API_KEY"
        }]
    }
    ```

    If you don't specify the `model` parameter, it will default to `replicate/llama-2-70b-chat:58d078176e02c219e11eb4da5a02a7830a283b14cf8f94537af893ccff5ee781`.
    """

    api_key: str = Field(..., description="Replicate API key")

    model: str = "replicate/llama-2-70b-chat:58d078176e02c219e11eb4da5a02a7830a283b14cf8f94537af893ccff5ee781"

    @property
    def _client(self) -> replicate.Client:
        return replicate.Client(api_token=self.api_key)

    def get_model_name(self):
        return {
            "codellama-7b": "meta/codellama-7b-instruct:6527b83e01e41412db37de5110a8670e3701ee95872697481a355e05ce12af0e",
            "codellama-13b": "meta/codellama-13b-instruct:1f01a52ff933873dff339d5fb5e1fd6f24f77456836f514fa05e91c1a42699c7",
            "codellama-34b": "meta/codellama-34b-instruct:8281a5c610f6e88237ff3ddaf3c33b56f60809e2bdd19fbec2fda742aa18167e",
            "llama2-7b": "meta/llama-2-7b-chat:8e6975e5ed6174911a6ff3d60540dfd4844201974602551e10e9e87ab143d81e",
            "llama2-13b": "meta/llama-2-13b-chat:f4e2de70d66816a838a89eeeb621910adffb0dd0baba3976c96980970978018d",
            "zephyr-7b": "nateraw/zephyr-7b-beta:b79f33de5c6c4e34087d44eaea4a9d98ce5d3f3a09522f7328eea0685003a931",
            "mistral-7b": "mistralai/mistral-7b-instruct-v0.1:83b6a56e7c828e667f21fd596c338fd4f0039b46bcfa18d973e8e70e455fda70",
            "wizardcoder-34b": "andreasjansson/wizardcoder-python-34b-v1-gguf:67eed332a5389263b8ede41be3ee7dc119fa984e2bde287814c4abed19a45e54",
        }.get(self.model, self.model)

    async def _complete(self, prompt: str, options):
        def helper():
            output = self._client.run(
                self.get_model_name(), input={"message": prompt, "prompt": prompt}
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
            self.get_model_name(), input={"message": prompt, "prompt": prompt}
        ):
            yield item

    async def _stream_chat(self, messages: List[ChatMessage], options):
        for item in self._client.run(
            self.get_model_name(),
            input={
                "message": messages[-1].content,
                "prompt": messages[-1].content,
            },
        ):
            yield ChatMessage(role="assistant", content=item)

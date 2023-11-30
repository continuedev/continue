import json
from typing import Any, Dict, Optional

from pydantic import Field, validator

from continuedev.models.llm import CompletionOptions

from ...core.main import ContinueCustomException
from ..util.logging import logger
from .base import LLM


class TogetherLLM(LLM):
    """
    The Together API is a cloud platform for running large AI models. You can sign up [here](https://api.together.xyz/signup), copy your API key on the initial welcome screen, and then hit the play button on any model from the [Together Models list](https://docs.together.ai/docs/models-inference). Change `~/.continue/config.json` to look like this:

    ```json title="~/.continue/config.json"
    {
        "models": [{
            "title": "Together CodeLlama",
            "provider": "together",
            "model": "codellama-13b",
            "api_key": "YOUR_API_KEY"
        }]
    }
    ```
    """

    api_key: str = Field(..., description="Together API key")

    model: str = "togethercomputer/RedPajama-INCITE-7B-Instruct"
    api_base: Optional[str] = Field(
        "https://api.together.xyz",
        description="The base URL for your Together API instance",
    )

    @validator("api_base", pre=True, always=True)
    def set_api_base(cls, api_base):
        return api_base or "https://api.together.xyz"

    def collect_args(self, options: CompletionOptions) -> Dict[str, Any]:
        args = super().collect_args(options)
        args["model"] = {
            "codellama-7b": "togethercomputer/CodeLlama-7b-Instruct",
            "codellama-13b": "togethercomputer/CodeLlama-13b-Instruct",
            "codellama-34b": "togethercomputer/CodeLlama-34b-Instruct",
            "llama2-7b": "togethercomputer/llama-2-7b-chat",
            "llama2-13b": "togethercomputer/llama-2-13b-chat",
            "llama2-70b": "togethercomputer/llama-2-70b-chat",
            "mistral-7b": "mistralai/Mistral-7B-Instruct-v0.1",
            "phind-codellama-34b": "Phind/Phind-CodeLlama-34B-v2"
        }.get(self.model, self.model)
        return args

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)

        async with self.create_client_session() as session:
            async with session.post(
                f"{self.api_base}/inference",
                json={
                    "prompt": prompt,
                    "stream_tokens": True,
                    **args,
                },
                headers={"Authorization": f"Bearer {self.api_key}"},
                proxy=self.request_options.proxy,
            ) as resp:
                async for line in resp.content.iter_chunks():
                    if line[1]:
                        json_chunk = line[0].decode("utf-8")
                        if json_chunk.startswith(": ping - ") or json_chunk.startswith(
                            "data: [DONE]"
                        ):
                            continue

                        chunks = json_chunk.split("\n")
                        for chunk in chunks:
                            if chunk.strip() != "":
                                if chunk.startswith("data: "):
                                    chunk = chunk[6:]
                                if chunk == "[DONE]":
                                    break
                                try:
                                    json_chunk = json.loads(chunk)
                                except Exception as e:
                                    logger.warning(
                                        f"Invalid JSON chunk: {chunk}\n\n{e}"
                                    )
                                    continue
                                if "error" in json_chunk:
                                    raise ContinueCustomException(
                                        message=json_chunk["error"],
                                        title="Together API Error",
                                    )
                                elif "choices" in json_chunk:
                                    yield json_chunk["choices"][0]["text"]

    async def _complete(self, prompt: str, options):
        args = self.collect_args(options)

        async with self.create_client_session() as session:
            async with session.post(
                f"{self.api_base}/inference",
                json={"prompt": prompt, **args},
                headers={"Authorization": f"Bearer {self.api_key}"},
                proxy=self.request_options.proxy,
            ) as resp:
                text = await resp.text()
                j = json.loads(text)
                try:
                    if "choices" not in j["output"]:
                        raise Exception(text)
                    if "output" in j:
                        return j["output"]["choices"][0]["text"]
                except Exception as e:
                    j = await resp.json()
                    if "error" in j:
                        if j["error"].startswith("invalid hexlify value"):
                            raise ContinueCustomException(
                                message=f"Invalid Together API key:\n\n{j['error']}",
                                title="Together API Error",
                            )
                        else:
                            raise ContinueCustomException(
                                message=j["error"], title="Together API Error"
                            )

                    raise e

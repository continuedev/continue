import json
from typing import Callable, Optional

import aiohttp
from pydantic import Field

from ...core.main import ContinueCustomException
from ..llm import LLM
from ..util.logging import logger
from .prompts.chat import llama2_template_messages
from .prompts.edit import simplified_edit_prompt


class TogetherLLM(LLM):
    """
    The Together API is a cloud platform for running large AI models. You can sign up [here](https://api.together.xyz/signup), copy your API key on the initial welcome screen, and then hit the play button on any model from the [Together Models list](https://docs.together.ai/docs/models-inference). Change `~/.continue/config.py` to look like this:

    ```python
    from continuedev.src.continuedev.core.models import Models
    from continuedev.src.continuedev.libs.llm.together import TogetherLLM

    config = ContinueConfig(
        ...
        models=Models(
            default=TogetherLLM(
                api_key="<API_KEY>",
                model="togethercomputer/llama-2-13b-chat"
            )
        )
    )
    ```
    """

    api_key: str = Field(..., description="Together API key")

    model: str = "togethercomputer/RedPajama-INCITE-7B-Instruct"
    base_url: str = Field(
        "https://api.together.xyz",
        description="The base URL for your Together API instance",
    )

    _client_session: aiohttp.ClientSession = None

    template_messages: Callable = llama2_template_messages

    prompt_templates = {
        "edit": simplified_edit_prompt,
    }

    async def start(self, **kwargs):
        await super().start(**kwargs)
        self._client_session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl),
            timeout=aiohttp.ClientTimeout(total=self.timeout),
        )

    async def stop(self):
        await self._client_session.close()

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)

        async with self._client_session.post(
            f"{self.base_url}/inference",
            json={
                "prompt": prompt,
                "stream_tokens": True,
                **args,
            },
            headers={"Authorization": f"Bearer {self.api_key}"},
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
                                logger.warning(f"Invalid JSON chunk: {chunk}\n\n{e}")
                                continue
                            if "choices" in json_chunk:
                                yield json_chunk["choices"][0]["text"]

    async def _complete(self, prompt: str, options):
        args = self.collect_args(options)

        async with self._client_session.post(
            f"{self.base_url}/inference",
            json={"prompt": prompt, **args},
            headers={"Authorization": f"Bearer {self.api_key}"},
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

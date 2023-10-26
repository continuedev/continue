import json
from typing import Any, Callable, Coroutine, Dict, List, Literal, Optional

from pydantic import Field

from ...core.main import ChatMessage, ContinueCustomException
from ..util.logging import logger
from .base import LLM, CompletionOptions
from .openai import CHAT_MODELS
from .prompts.chat import llama2_template_messages
from .prompts.edit import codellama_edit_prompt


class GGML(LLM):
    """
    See our [5 minute quickstart](https://github.com/continuedev/ggml-server-example) to run any model locally with ggml. While these models don't yet perform as well, they are free, entirely private, and run offline.

    Once the model is running on localhost:8000, change `~/.continue/config.py` to look like this:

    ```python title="~/.continue/config.py"
    from continuedev.libs.llm.ggml import GGML

    config = ContinueConfig(
        ...
        models=Models(
            default=GGML(
                max_context_length=2048,
                server_url="http://localhost:8000")
        )
    )
    ```
    """

    server_url: str = Field(
        "http://localhost:8000",
        description="URL of the OpenAI-compatible server where the model is being served",
    )
    model: str = Field(
        "ggml", description="The name of the model to use (optional for the GGML class)"
    )

    api_base: Optional[str] = Field(None, description="OpenAI API base URL.")

    api_type: Optional[Literal["azure", "openai"]] = Field(
        None, description="OpenAI API type."
    )

    api_version: Optional[str] = Field(
        None, description="OpenAI API version. For use with Azure OpenAI Service."
    )

    engine: Optional[str] = Field(
        None, description="OpenAI engine. For use with Azure OpenAI Service."
    )

    api_base: Optional[str] = Field(None, description="OpenAI API base URL.")

    api_type: Optional[Literal["azure", "openai"]] = Field(
        None, description="OpenAI API type."
    )

    api_version: Optional[str] = Field(
        None, description="OpenAI API version. For use with Azure OpenAI Service."
    )

    engine: Optional[str] = Field(
        None, description="OpenAI engine. For use with Azure OpenAI Service."
    )

    template_messages: Optional[
        Callable[[List[Dict[str, str]]], str]
    ] = llama2_template_messages

    prompt_templates = {
        "edit": codellama_edit_prompt,
    }

    class Config:
        arbitrary_types_allowed = True

    def get_headers(self):
        headers = {
            "Content-Type": "application/json",
        }
        if self.api_key is not None:
            if self.api_type == "azure":
                headers["api-key"] = self.api_key
            else:
                headers["Authorization"] = f"Bearer {self.api_key}"

        return headers

    def get_full_server_url(self, endpoint: str):
        endpoint = endpoint.lstrip("/").rstrip("/")

        if self.api_type == "azure":
            if self.engine is None or self.api_version is None or self.api_base is None:
                raise Exception(
                    "For Azure OpenAI Service, you must specify engine, api_version, and api_base."
                )

            return f"{self.api_base}/openai/deployments/{self.engine}/{endpoint}?api-version={self.api_version}"
        else:
            return f"{self.server_url}/v1/{endpoint}"

    def get_full_server_url(self, endpoint: str):
        endpoint = endpoint.lstrip("/").rstrip("/")

        if self.api_type == "azure":
            if self.engine is None or self.api_version is None or self.api_base is None:
                raise Exception(
                    "For Azure OpenAI Service, you must specify engine, api_version, and api_base."
                )

            return f"{self.api_base}/openai/deployments/{self.engine}/{endpoint}?api-version={self.api_version}"
        else:
            return f"{self.server_url}/v1/{endpoint}"

    async def _raw_stream_complete(self, prompt, options):
        args = self.collect_args(options)

        async with self.create_client_session() as client_session:
            async with client_session.post(
                self.get_full_server_url(endpoint="completions"),
                json={
                    "prompt": prompt,
                    "stream": True,
                    **args,
                },
                headers=self.get_headers(),
                proxy=self.proxy,
            ) as resp:
                if resp.status != 200:
                    raise Exception(
                        f"Error calling /chat/completions endpoint: {resp.status}"
                    )

                async for line in resp.content.iter_any():
                    if line:
                        chunks = line.decode("utf-8")
                        for chunk in chunks.split("\n"):
                            if (
                                chunk.startswith(": ping - ")
                                or chunk.startswith("data: [DONE]")
                                or chunk.strip() == ""
                            ):
                                continue
                            elif chunk.startswith("data: "):
                                chunk = chunk[6:]
                            try:
                                j = json.loads(chunk)
                            except Exception:
                                continue
                            if (
                                "choices" in j
                                and len(j["choices"]) > 0
                                and "text" in j["choices"][0]
                            ):
                                yield j["choices"][0]["text"]

    async def _stream_chat(self, messages: List[ChatMessage], options):
        args = self.collect_args(options)

        async def generator():
            async with self.create_client_session() as client_session:
                async with client_session.post(
                    self.get_full_server_url(endpoint="chat/completions"),
                    json={"messages": messages, "stream": True, **args},
                    headers=self.get_headers(),
                    proxy=self.proxy,
                ) as resp:
                    if resp.status != 200:
                        detail = (
                            f"Error calling /chat/completions endpoint: {resp.status}"
                        )
                        try:
                            json_detail = await resp.json()
                            if (
                                "detail" in json_detail
                                and "error" in json_detail["detail"]
                                and "message" in json_detail["detail"]["error"]
                            ):
                                detail = json_detail["detail"]["error"]["message"]
                            elif "message" in json_detail:
                                detail = json_detail["message"]
                            elif "detail" in json_detail:
                                detail = json_detail["detail"]
                        except:
                            pass

                        raise ContinueCustomException(
                            title=f"Error calling /chat/completions endpoint: {resp.status}",
                            message=detail,
                        )

                    async for line, end in resp.content.iter_chunks():
                        json_chunk = line.decode("utf-8")
                        chunks = json_chunk.split("\n")
                        for chunk in chunks:
                            if (
                                chunk.strip() == ""
                                or json_chunk.startswith(": ping - ")
                                or json_chunk.startswith("data: [DONE]")
                            ):
                                continue
                            try:
                                yield json.loads(chunk[6:])["choices"][0]["delta"]
                            except:
                                pass

        # Because quite often the first attempt fails, and it works thereafter
        try:
            async for chunk in generator():
                yield chunk
        except Exception as e:
            logger.warning(f"Error calling /chat/completions endpoint: {e}")
            async for chunk in generator():
                yield chunk

    async def _raw_complete(self, prompt: str, options) -> Coroutine[Any, Any, str]:
        args = self.collect_args(options)

        async with self.create_client_session() as client_session:
            async with client_session.post(
                self.get_full_server_url(endpoint="completions"),
                json={
                    "prompt": prompt,
                    **args,
                },
                headers=self.get_headers(),
                proxy=self.proxy,
            ) as resp:
                if resp.status != 200:
                    raise Exception(
                        f"Error calling /chat/completions endpoint: {resp.status}"
                    )

                text = await resp.text()
                try:
                    completion = json.loads(text)["choices"][0]["text"]
                    return completion
                except Exception as e:
                    raise Exception(
                        f"Error calling /completion endpoint: {e}\n\nResponse text: {text}"
                    )

    async def _complete(self, prompt: str, options: CompletionOptions):
        completion = ""
        if self.model in CHAT_MODELS:
            async for chunk in self._stream_chat(
                [{"role": "user", "content": prompt}], options
            ):
                if "content" in chunk:
                    completion += chunk["content"]

        else:
            async for chunk in self._raw_stream_complete(prompt, options):
                completion += chunk

        return completion

    async def _stream_complete(self, prompt, options: CompletionOptions):
        if self.model in CHAT_MODELS:
            async for chunk in self._stream_chat(
                [{"role": "user", "content": prompt}], options
            ):
                if "content" in chunk:
                    yield chunk["content"]

        else:
            async for chunk in self._raw_stream_complete(prompt, options):
                yield chunk

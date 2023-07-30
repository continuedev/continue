from functools import cached_property
import json
from typing import Any, Callable, Coroutine, Dict, Generator, List, Union, Optional

from pydantic import BaseModel
from ...core.main import ChatMessage
import openai
from ..llm import LLM
from ..util.count_tokens import compile_chat_messages, CHAT_MODELS, DEFAULT_ARGS, count_tokens, format_chat_messages, prune_raw_prompt_from_top


class AzureInfo(BaseModel):
    endpoint: str
    engine: str
    api_version: str


class OpenAI(LLM):
    model: str

    requires_api_key = "OPENAI_API_KEY"
    requires_write_log = True

    system_message: Optional[str] = None
    azure_info: Optional[AzureInfo] = None
    write_log: Optional[Callable[[str], None]] = None
    api_key: str = None

    async def start(self, *, api_key):
        self.api_key = api_key
        openai.api_key = self.api_key

        # Using an Azure OpenAI deployment
        if self.azure_info is not None:
            openai.api_type = "azure"
            openai.api_base = self.azure_info.endpoint
            openai.api_version = self.azure_info.api_version

    async def stop(self):
        pass

    @property
    def name(self):
        return self.model

    @property
    def default_args(self):
        args = {**DEFAULT_ARGS, "model": self.model}
        if self.azure_info is not None:
            args["engine"] = self.azure_info.engine
        return args

    def count_tokens(self, text: str):
        return count_tokens(self.model, text)

    async def stream_complete(self, prompt, with_history: List[ChatMessage] = None, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.default_args.copy()
        args.update(kwargs)
        args["stream"] = True

        if args["model"] in CHAT_MODELS:
            messages = compile_chat_messages(
                args["model"], with_history, args["max_tokens"], prompt, functions=None, system_message=self.system_message)
            self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")
            completion = ""
            async for chunk in await openai.ChatCompletion.acreate(
                messages=messages,
                **args,
            ):
                if "content" in chunk.choices[0].delta:
                    yield chunk.choices[0].delta.content
                    completion += chunk.choices[0].delta.content
                else:
                    continue

            self.write_log(f"Completion: \n\n{completion}")
        else:
            self.write_log(f"Prompt:\n\n{prompt}")
            completion = ""
            async for chunk in await openai.Completion.acreate(prompt=prompt, **args):
                yield chunk.choices[0].text
                completion += chunk.choices[0].text

            self.write_log(f"Completion:\n\n{completion}")

    async def stream_chat(self, messages: List[ChatMessage] = None, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.default_args.copy()
        args.update(kwargs)
        args["stream"] = True
        # TODO what to do here? why should we change to gpt-3.5-turbo-0613 if the user didn't ask for it?
        args["model"] = self.model if self.model in CHAT_MODELS else "gpt-3.5-turbo-0613"
        if not args["model"].endswith("0613") and "functions" in args:
            del args["functions"]

        messages = compile_chat_messages(
            args["model"], messages, args["max_tokens"], None, functions=args.get("functions", None), system_message=self.system_message)
        self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")
        completion = ""
        async for chunk in await openai.ChatCompletion.acreate(
            messages=messages,
            **args,
        ):
            yield chunk.choices[0].delta
            if "content" in chunk.choices[0].delta:
                completion += chunk.choices[0].delta.content
        self.write_log(f"Completion: \n\n{completion}")

    async def complete(self, prompt: str, with_history: List[ChatMessage] = None, **kwargs) -> Coroutine[Any, Any, str]:
        args = {**self.default_args, **kwargs}

        if args["model"] in CHAT_MODELS:
            messages = compile_chat_messages(
                args["model"], with_history, args["max_tokens"], prompt, functions=None, system_message=self.system_message)
            self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")
            resp = (await openai.ChatCompletion.acreate(
                messages=messages,
                **args,
            )).choices[0].message.content
            self.write_log(f"Completion: \n\n{resp}")
        else:
            prompt = prune_raw_prompt_from_top(
                args["model"], prompt, args["max_tokens"])
            self.write_log(f"Prompt:\n\n{prompt}")
            resp = (await openai.Completion.acreate(
                prompt=prompt,
                **args,
            )).choices[0].text
            self.write_log(f"Completion:\n\n{resp}")

        return resp

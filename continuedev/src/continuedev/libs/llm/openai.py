from typing import Any, Callable, Coroutine, Dict, Generator, List, Literal, Union, Optional

from pydantic import BaseModel
import openai

from ...core.main import ChatMessage
from ..util.count_tokens import compile_chat_messages, DEFAULT_ARGS, count_tokens, format_chat_messages, prune_raw_prompt_from_top
from ..llm import LLM
import certifi


class OpenAIServerInfo(BaseModel):
    api_base: Optional[str] = None
    engine: Optional[str] = None
    api_version: Optional[str] = None
    api_type: Literal["azure", "openai"] = "openai"


CHAT_MODELS = {
    "gpt-3.5-turbo", "gpt-3.5-turbo-16k", "gpt-4", "gpt-3.5-turbo-0613"
}
MAX_TOKENS_FOR_MODEL = {
    "gpt-3.5-turbo": 4096,
    "gpt-3.5-turbo-0613": 4096,
    "gpt-3.5-turbo-16k": 16384,
    "gpt-4": 8192,
    "gpt-35-turbo-16k": 16384,
    "gpt-35-turbo-0613": 4096,
    "gpt-35-turbo": 4096,
}


class OpenAI(LLM):
    api_key: str
    model: str
    openai_server_info: Optional[OpenAIServerInfo] = None
    verify_ssl: bool = True
    ca_bundle_path: Optional[str] = None

    requires_write_log = True

    system_message: Optional[str] = None
    write_log: Optional[Callable[[str], None]] = None

    async def start(self, *, api_key: Optional[str] = None, write_log: Callable[[str], None], **kwargs):
        self.write_log = write_log
        openai.api_key = self.api_key

        if self.openai_server_info is not None:
            openai.api_type = self.openai_server_info.api_type
            if self.openai_server_info.api_base is not None:
                openai.api_base = self.openai_server_info.api_base
            if self.openai_server_info.api_version is not None:
                openai.api_version = self.openai_server_info.api_version

        if self.verify_ssl == False:
            openai.verify_ssl_certs = False

        openai.ca_bundle_path = self.ca_bundle_path or certifi.where()

    async def stop(self):
        pass

    @property
    def name(self):
        return self.model

    @property
    def context_length(self):
        return MAX_TOKENS_FOR_MODEL[self.model]

    @property
    def default_args(self):
        args = {**DEFAULT_ARGS, "model": self.model}
        if self.openai_server_info is not None:
            args["engine"] = self.openai_server_info.engine
        return args

    def count_tokens(self, text: str):
        return count_tokens(self.model, text)

    async def stream_complete(self, prompt, with_history: List[ChatMessage] = None, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.default_args.copy()
        args.update(kwargs)
        args["stream"] = True

        if args["model"] in CHAT_MODELS:
            messages = compile_chat_messages(
                args["model"], with_history, self.context_length, args["max_tokens"], prompt, functions=None, system_message=self.system_message)
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
                    continue  # :)

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
            args["model"], messages, self.context_length, args["max_tokens"], None, functions=args.get("functions", None), system_message=self.system_message)
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
                args["model"], with_history, self.context_length, args["max_tokens"], prompt, functions=None, system_message=self.system_message)
            self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")
            resp = (await openai.ChatCompletion.acreate(
                messages=messages,
                **args,
            )).choices[0].message.content
            self.write_log(f"Completion: \n\n{resp}")
        else:
            prompt = prune_raw_prompt_from_top(
                args["model"], self.context_length, prompt, args["max_tokens"])
            self.write_log(f"Prompt:\n\n{prompt}")
            resp = (await openai.Completion.acreate(
                prompt=prompt,
                **args,
            )).choices[0].text
            self.write_log(f"Completion:\n\n{resp}")

        return resp

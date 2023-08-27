import json
from textwrap import dedent
from typing import Any, Callable, Coroutine, Dict, Generator, List, Optional, Union

import aiohttp

from ...core.main import ChatMessage
from ..llm import LLM
from ..util.count_tokens import (
    DEFAULT_ARGS,
    compile_chat_messages,
    count_tokens,
    format_chat_messages,
)


def llama2_template_messages(msgs: ChatMessage) -> str:
    if len(msgs) == 0:
        return ""

    prompt = ""
    has_system = msgs[0]["role"] == "system"
    if has_system:
        system_message = dedent(
            f"""\
                <<SYS>>
                {msgs[0]["content"]}
                <</SYS>>
                
                """
        )
        if len(msgs) > 1:
            prompt += f"[INST] {system_message}{msgs[1]['content']} [/INST]"
        else:
            prompt += f"[INST] {system_message} [/INST]"
            return

    for i in range(2 if has_system else 0, len(msgs)):
        if msgs[i]["role"] == "user":
            prompt += f"[INST] {msgs[i]['content']} [/INST]"
        else:
            prompt += msgs[i]["content"]

    return prompt


def code_llama_template_messages(msgs: ChatMessage) -> str:
    return f"[INST] {msgs[-1]['content']} [/INST]"


def code_llama_python_template_messages(msgs: ChatMessage) -> str:
    return dedent(
        f"""\
        [INST]
        You are an expert Python programmer and personal assistant, here is your task: {msgs[-1]['content']}
        Your answer should start with a [PYTHON] tag and end with a [/PYTHON] tag.
        [/INST]"""
    )


class LlamaCpp(LLM):
    max_context_length: int = 2048
    server_url: str = "http://localhost:8080"
    verify_ssl: Optional[bool] = None

    template_messages: Callable[[List[ChatMessage]], str] = llama2_template_messages
    llama_cpp_args: Dict[str, Any] = {"stop": ["[INST]"]}

    requires_write_log = True
    write_log: Optional[Callable[[str], None]] = None

    class Config:
        arbitrary_types_allowed = True

    def dict(self, **kwargs):
        d = super().dict(**kwargs)
        d.pop("template_messages")
        return d

    async def start(self, write_log: Callable[[str], None], **kwargs):
        self.write_log = write_log

    async def stop(self):
        await self._client_session.close()

    @property
    def name(self):
        return "llamacpp"

    @property
    def context_length(self):
        return self.max_context_length

    @property
    def default_args(self):
        return {**DEFAULT_ARGS, "model": self.name, "max_tokens": 1024}

    def count_tokens(self, text: str):
        return count_tokens(self.name, text)

    def _transform_args(self, args: Dict[str, Any]) -> Dict[str, Any]:
        args = args.copy()
        if "max_tokens" in args:
            args["n_predict"] = args["max_tokens"]
            del args["max_tokens"]
        if "frequency_penalty" in args:
            del args["frequency_penalty"]
        if "presence_penalty" in args:
            del args["presence_penalty"]

        for k, v in self.llama_cpp_args.items():
            if k not in args:
                args[k] = v

        return args

    async def stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.default_args.copy()
        args.update(kwargs)
        args["stream"] = True

        args = {**self.default_args, **kwargs}
        messages = compile_chat_messages(
            self.name,
            with_history,
            self.context_length,
            args["max_tokens"],
            prompt,
            functions=args.get("functions", None),
            system_message=self.system_message,
        )

        self.write_log(f"Prompt: \n\n{format_chat_messages(messages)}")
        completion = ""
        async with aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl)
        ) as client_session:
            async with client_session.post(
                f"{self.server_url}/completion",
                json={
                    "prompt": self.convert_to_chat(messages),
                    **self._transform_args(args),
                },
                headers={"Content-Type": "application/json"},
            ) as resp:
                async for line in resp.content.iter_any():
                    if line:
                        chunk = line.decode("utf-8")
                        yield chunk
                        completion += chunk

        self.write_log(f"Completion: \n\n{completion}")

    async def stream_chat(
        self, messages: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = {**self.default_args, **kwargs}
        messages = compile_chat_messages(
            self.name,
            messages,
            self.context_length,
            args["max_tokens"],
            None,
            functions=args.get("functions", None),
            system_message=self.system_message,
        )
        args["stream"] = True

        prompt = self.template_messages(messages)
        headers = {"Content-Type": "application/json"}

        async def generator():
            async with aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl)
            ) as client_session:
                async with client_session.post(
                    f"{self.server_url}/completion",
                    json={"prompt": prompt, **self._transform_args(args)},
                    headers=headers,
                ) as resp:
                    async for line in resp.content:
                        content = line.decode("utf-8")
                        if content.strip() == "":
                            continue
                        yield {
                            "content": json.loads(content[6:])["content"],
                            "role": "assistant",
                        }

        # Because quite often the first attempt fails, and it works thereafter
        self.write_log(f"Prompt: \n\n{prompt}")
        completion = ""
        async for chunk in generator():
            yield chunk
            if "content" in chunk:
                completion += chunk["content"]

        self.write_log(f"Completion: \n\n{completion}")

    async def complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ) -> Coroutine[Any, Any, str]:
        args = {**self.default_args, **kwargs}

        self.write_log(f"Prompt: \n\n{prompt}")
        async with aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl)
        ) as client_session:
            async with client_session.post(
                f"{self.server_url}/completion",
                json={"prompt": prompt, **self._transform_args(args)},
                headers={"Content-Type": "application/json"},
            ) as resp:
                json_resp = await resp.json()
                completion = json_resp["content"]
                self.write_log(f"Completion: \n\n{completion}")
                return completion

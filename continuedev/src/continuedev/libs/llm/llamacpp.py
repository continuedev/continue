import asyncio
import json
from typing import Any, Callable, Coroutine, Dict, Generator, List, Optional, Union

import aiohttp

from ...core.main import ChatMessage
from ..llm import LLM
from ..util.count_tokens import DEFAULT_ARGS, compile_chat_messages, count_tokens
from .prompts.chat import llama2_template_messages


class LlamaCpp(LLM):
    max_context_length: int = 2048
    server_url: str = "http://localhost:8080"
    verify_ssl: Optional[bool] = None

    template_messages: Callable[[List[ChatMessage]], str] = llama2_template_messages
    llama_cpp_args: Dict[str, Any] = {"stop": ["[INST]"], "grammar": "root ::= "}

    use_command: Optional[str] = None

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

    async def stream_from_main(self, prompt: str):
        cmd = self.use_command.split(" ") + ["-p", prompt]
        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE
        )

        total = ""
        async for line in process.stdout:
            chunk = line.decode().strip()
            if "llama_print_timings" in total + chunk:
                process.terminate()
                return
            total += chunk
            yield chunk

        await process.wait()

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

        prompt = self.convert_to_chat(messages)
        self.write_log(f"Prompt: \n\n{prompt}")
        completion = ""
        async with aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl)
        ) as client_session:
            async with client_session.post(
                f"{self.server_url}/completion",
                json={
                    "prompt": prompt,
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

        async def server_generator():
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

        async def command_generator():
            async for line in self.stream_from_main(prompt):
                yield {"content": line, "role": "assistant"}

        generator = command_generator if self.use_command else server_generator

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

        if self.use_command:
            completion = ""
            async for line in self.stream_from_main(prompt):
                completion += line
            self.write_log(f"Completion: \n\n{completion}")
            return completion
        else:
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

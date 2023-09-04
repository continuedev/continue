import asyncio
import json
from typing import Any, Callable, Dict, Optional

import aiohttp

from ..llm import LLM
from .prompts.chat import llama2_template_messages
from .prompts.edit import simplified_edit_prompt


class LlamaCpp(LLM):
    model: str = "llamacpp"
    server_url: str = "http://localhost:8080"
    verify_ssl: Optional[bool] = None

    llama_cpp_args: Dict[str, Any] = {"stop": ["[INST]"]}

    use_command: Optional[str] = None

    template_messages: Callable = llama2_template_messages
    prompt_templates = {
        "edit": simplified_edit_prompt,
    }

    class Config:
        arbitrary_types_allowed = True

    def collect_args(self, options) -> Any:
        args = super().collect_args(options)
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

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)
        headers = {"Content-Type": "application/json"}

        async def server_generator():
            async with aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl),
                timeout=aiohttp.ClientTimeout(total=self.timeout),
            ) as client_session:
                async with client_session.post(
                    f"{self.server_url}/completion",
                    json={"prompt": prompt, "stream": True, **args},
                    headers=headers,
                ) as resp:
                    async for line in resp.content:
                        content = line.decode("utf-8")
                        if content.strip() == "":
                            continue
                        yield json.loads(content[6:])["content"]

        async def command_generator():
            async for line in self.stream_from_main(prompt):
                yield line

        generator = command_generator if self.use_command else server_generator
        async for chunk in generator():
            yield chunk

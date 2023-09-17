import json
from typing import Any, Callable, Dict

import aiohttp
from pydantic import Field

from ..llm import LLM
from .prompts.chat import llama2_template_messages
from .prompts.edit import simplified_edit_prompt


class LlamaCpp(LLM):
    """
    Run the llama.cpp server binary to start the API server. If running on a remote server, be sure to set host to 0.0.0.0:

    ```shell
    .\server.exe -c 4096 --host 0.0.0.0 -t 16 --mlock -m models\meta\llama\codellama-7b-instruct.Q8_0.gguf
    ```

    After it's up and running, change `~/.continue/config.py` to look like this:

    ```python
    from continuedev.src.continuedev.libs.llm.llamacpp import LlamaCpp

    config = ContinueConfig(
        ...
        models=Models(
            default=LlamaCpp(
                max_context_length=4096,
                server_url="http://localhost:8080")
        )
    )
    ```
    """

    model: str = "llamacpp"
    server_url: str = Field("http://localhost:8080", description="URL of the server")

    llama_cpp_args: Dict[str, Any] = Field(
        {"stop": ["[INST]"]},
        description="A list of additional arguments to pass to llama.cpp. See [here](https://github.com/ggerganov/llama.cpp/tree/master/examples/server#api-endpoints) for the complete catalog of options.",
    )

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

        async for chunk in server_generator():
            yield chunk

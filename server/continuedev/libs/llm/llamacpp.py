import json
from typing import Any, Dict, Optional

from pydantic import Field, validator

from .base import LLM


class LlamaCpp(LLM):
    """
    Run the llama.cpp server binary to start the API server. If running on a remote server, be sure to set host to 0.0.0.0:

    ```shell
    .\\server.exe -c 4096 --host 0.0.0.0 -t 16 --mlock -m models\\meta\\llama\\codellama-7b-instruct.Q8_0.gguf
    ```

    After it's up and running, change `~/.continue/config.json` to look like this:

    ```json title="~/.continue/config.json"
    {
        "models": [{
            "title": "Llama CPP",
            "provider": "llama.cpp",
            "model": "MODEL_NAME",
            "api_base": "http://localhost:8080"
        }]
    }
    ```
    """

    model: str = "llamacpp"
    api_base: Optional[str] = Field(
        "http://localhost:8080", description="URL of the server"
    )

    @validator("api_base", pre=True, always=True)
    def set_api_base(cls, api_base):
        return api_base or "http://localhost:8080"

    llama_cpp_args: Dict[str, Any] = Field(
        {"stop": ["[INST]"]},
        description="A list of additional arguments to pass to llama.cpp. See [here](https://github.com/ggerganov/llama.cpp/tree/master/examples/server#api-endpoints) for the complete catalog of options.",
    )

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
            async with self.create_client_session() as client_session:
                async with client_session.post(
                    f"{self.api_base}/completion",
                    json={"prompt": prompt, "stream": True, **args},
                    headers=headers,
                    proxy=self.request_options.proxy,
                ) as resp:
                    async for line in resp.content:
                        content = line.decode("utf-8")
                        if content.strip() == "":
                            continue
                        yield json.loads(content[6:])["content"]

        async for chunk in server_generator():
            yield chunk

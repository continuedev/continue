import json
from typing import Any, Optional

from pydantic import Field, validator

from ..util.count_tokens import DEFAULT_MAX_TOKENS
from .base import LLM, CompletionOptions


class HuggingFaceTGI(LLM):
    model: str = "huggingface-tgi"
    api_base: Optional[str] = Field(
        "http://localhost:8080", description="URL of your TGI server"
    )

    @validator("api_base", pre=True, always=True)
    def set_api_base(cls, api_base):
        return api_base or "http://localhost:8080"

    class Config:
        arbitrary_types_allowed = True

    def collect_args(self, options: CompletionOptions) -> Any:
        args = super().collect_args(options)
        args = {
            **args,
            "max_new_tokens": args.get("max_tokens", DEFAULT_MAX_TOKENS),
            "best_of": 1,
        }
        args.pop("max_tokens", None)
        args.pop("model", None)
        args.pop("functions", None)
        return args

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)

        async with self.create_client_session() as client_session:
            async with client_session.post(
                f"{self.api_base}/generate_stream",
                json={"inputs": prompt, "parameters": args},
                headers={"Content-Type": "application/json"},
                proxy=self.request_options.proxy,
            ) as resp:
                async for line in resp.content.iter_any():
                    if line:
                        text = line.decode("utf-8")
                        chunks = text.split("\n")

                        for chunk in chunks:
                            if chunk.startswith("data: "):
                                chunk = chunk[len("data: ") :]
                            elif chunk.startswith("data:"):
                                chunk = chunk[len("data:") :]

                            if chunk.strip() == "":
                                continue

                            try:
                                json_chunk = json.loads(chunk)
                            except Exception as e:
                                print(f"Error parsing JSON: {e}")
                                continue

                            yield json_chunk["token"]["text"]

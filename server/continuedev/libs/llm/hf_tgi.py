import json
from typing import Any, Callable, List
from continuedev.libs.util.count_tokens import DEFAULT_MAX_TOKENS

from pydantic import Field

from ...core.main import ChatMessage
from .base import LLM, CompletionOptions
from .prompts.chat import llama2_template_messages
from .prompts.edit import codellama_edit_prompt


class HuggingFaceTGI(LLM):
    model: str = "huggingface-tgi"
    server_url: str = Field(
        "http://localhost:8080", description="URL of your TGI server"
    )

    template_messages: Callable[[List[ChatMessage]], str] = llama2_template_messages

    prompt_templates = {
        "edit": codellama_edit_prompt,
    }

    class Config:
        arbitrary_types_allowed = True

    def collect_args(self, options: CompletionOptions) -> Any:
        args = super().collect_args(options)
        args = {**args, "max_new_tokens": args.get("max_tokens", DEFAULT_MAX_TOKENS), "best_of": 1}
        args.pop("max_tokens", None)
        args.pop("model", None)
        args.pop("functions", None)
        return args

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)

        async with self.create_client_session() as client_session:
            async with client_session.post(
                f"{self.server_url}/generate_stream",
                json={"inputs": prompt, "parameters": args},
                headers={"Content-Type": "application/json"},
                proxy=self.proxy,
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

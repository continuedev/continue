import json
from typing import Any, Callable, List, Optional

import aiohttp
from pydantic import Field

from ...core.main import ChatMessage
from ..llm import LLM, CompletionOptions
from .prompts.chat import code_llama_template_messages
from .prompts.edit import simplified_edit_prompt


class HuggingFaceTGI(LLM):
    model: str = "huggingface-tgi"
    server_url: str = Field(
        "http://localhost:8080", description="URL of your TGI server"
    )
    verify_ssl: Optional[bool] = Field(
        None,
        description="Whether SSL certificates should be verified when making the HTTP request",
    )

    template_messages: Callable[[List[ChatMessage]], str] = code_llama_template_messages

    prompt_templates = {
        "edit": simplified_edit_prompt,
    }

    class Config:
        arbitrary_types_allowed = True

    def collect_args(self, options: CompletionOptions) -> Any:
        args = super().collect_args(options)
        args = {**args, "max_new_tokens": args.get("max_tokens", 1024), "best_of": 1}
        args.pop("max_tokens")
        args.pop("model")
        args.pop("functions")
        return args

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)

        async with aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl),
            timeout=aiohttp.ClientTimeout(total=self.timeout),
        ) as client_session:
            async with client_session.post(
                f"{self.server_url}/generate_stream",
                json={"inputs": prompt, "parameters": args},
            ) as resp:
                async for line in resp.content.iter_any():
                    if line:
                        chunk = line.decode("utf-8")
                        try:
                            json_chunk = json.loads(chunk)
                        except Exception as e:
                            print(f"Error parsing JSON: {e}")
                            continue
                        text = json_chunk["details"]["best_of_sequences"][0][
                            "generated_text"
                        ]
                        yield text

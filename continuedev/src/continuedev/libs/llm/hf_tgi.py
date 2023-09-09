import json
from typing import Any, Callable, List, Optional

import aiohttp

from ...core.main import ChatMessage
from ..llm import LLM, CompletionOptions
from .prompts.chat import code_llama_template_messages
from .prompts.edit import simplified_edit_prompt


class HuggingFaceTGI(LLM):
    model: str = "huggingface-tgi"
    server_url: str = "http://localhost:8080"
    verify_ssl: Optional[bool] = None

    template_messages: Callable[[List[ChatMessage]], str] = code_llama_template_messages

    prompt_templates = {
        "edit": simplified_edit_prompt,
    }

    class Config:
        arbitrary_types_allowed = True

    def collect_args(self, options: CompletionOptions) -> Any:
        args = super().collect_args(options)
        args = {
            **args,
            "max_new_tokens": args.get("max_tokens", 1024),
        }
        args.pop("max_tokens", None)
        return args

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)

        async with aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl),
            timeout=aiohttp.ClientTimeout(total=self.timeout),
        ) as client_session:
            async with client_session.post(
                f"{self.server_url}",
                json={"inputs": prompt, "stream": True, **args},
            ) as resp:
                async for line in resp.content.iter_any():
                    if line:
                        chunk = line.decode("utf-8")
                        json_chunk = json.loads(chunk)
                        text = json_chunk["details"]["best_of_sequences"][0][
                            "generated_text"
                        ]
                        yield text

import json
from typing import Any, Callable, Coroutine, Dict, Generator, List, Optional, Union

import aiohttp

from ...core.main import ChatMessage
from ..llm import LLM
from ..util.count_tokens import compile_chat_messages
from .prompts.chat import code_llama_template_messages


class HuggingFaceTGI(LLM):
    model: str = "huggingface-tgi"
    server_url: str = "http://localhost:8080"
    verify_ssl: Optional[bool] = None

    template_messages: Callable[[List[ChatMessage]], str] = code_llama_template_messages

    class Config:
        arbitrary_types_allowed = True

    def collect_args(self, **kwargs) -> Any:
        args = super().collect_args(**kwargs)
        args = {
            **args,
            "max_new_tokens": args.get("max_tokens", 1024),
        }
        args.pop("max_tokens", None)
        return args

    async def _stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.collect_args(**kwargs)
        args["stream"] = True

        messages = compile_chat_messages(
            self.model,
            with_history,
            self.context_length,
            args["max_tokens"],
            prompt,
            functions=args.get("functions", None),
            system_message=self.system_message,
        )

        prompt = self.template_messages(messages)
        self.write_log(f"Prompt: \n\n{prompt}")
        completion = ""
        async with aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(verify_ssl=self.verify_ssl)
        ) as client_session:
            async with client_session.post(
                f"{self.server_url}",
                json={"inputs": prompt, **args},
            ) as resp:
                async for line in resp.content.iter_any():
                    if line:
                        chunk = line.decode("utf-8")
                        json_chunk = json.loads(chunk)
                        text = json_chunk["details"]["best_of_sequences"][0][
                            "generated_text"
                        ]
                        yield text
                        completion += text

        self.write_log(f"Completion: \n\n{completion}")

    async def _stream_chat(
        self, messages: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.collect_args(**kwargs)
        messages = compile_chat_messages(
            self.model,
            messages,
            self.context_length,
            args["max_tokens"],
            None,
            functions=args.get("functions", None),
            system_message=self.system_message,
        )

        async for chunk in self._stream_complete(
            None, self.template_messages(messages), **args
        ):
            yield {
                "role": "assistant",
                "content": chunk,
            }

    async def _complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ) -> Coroutine[Any, Any, str]:
        args = self.collect_args(**kwargs)

        completion = ""
        async for chunk in self._stream_complete(prompt, with_history, **args):
            completion += chunk

        return completion

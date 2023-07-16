
from functools import cached_property
import time
from typing import Any, Coroutine, Dict, Generator, List, Union
from ...core.main import ChatMessage
from anthropic import Anthropic, HUMAN_PROMPT, AI_PROMPT
from ..llm import LLM
from ..util.count_tokens import DEFAULT_MAX_TOKENS, compile_chat_messages, CHAT_MODELS, DEFAULT_ARGS, count_tokens, prune_raw_prompt_from_top


class AnthropicLLM(LLM):
    api_key: str
    default_model: str
    anthropic: Anthropic

    def __init__(self, api_key: str, default_model: str, system_message: str = None):
        self.api_key = api_key
        self.default_model = default_model
        self.system_message = system_message

        self.anthropic = Anthropic(api_key)

    @cached_property
    def name(self):
        return self.default_model

    @property
    def default_args(self):
        return {**DEFAULT_ARGS, "model": self.default_model}

    def count_tokens(self, text: str):
        return count_tokens(self.default_model, text)

    def __messages_to_prompt(self, messages: List[ChatMessage]) -> str:
        prompt = ""
        for msg in messages:
            prompt += f"{HUMAN_PROMPT if msg.role == 'user' else AI_PROMPT} {msg.content} "

        return prompt

    async def stream_complete(self, prompt, with_history: List[ChatMessage] = [], **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.default_args.copy()
        args.update(kwargs)
        args["stream"] = True

        async for chunk in await self.anthropic.completions.create(
            model=args["model"],
            max_tokens_to_sample=args["max_tokens"],
            prompt=f"{HUMAN_PROMPT} {prompt} {AI_PROMPT}",
            **args
        ):
            yield chunk.completion

    async def stream_chat(self, messages: List[ChatMessage] = [], **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.default_args.copy()
        args.update(kwargs)
        args["stream"] = True

        messages = compile_chat_messages(
            args["model"], messages, args["max_tokens"], functions=args.get("functions", None))
        async for chunk in await self.anthropic.completions.create(
            model=args["model"],
            max_tokens_to_sample=args["max_tokens"],
            prompt=self.__messages_to_prompt(messages),
            **args
        ):
            yield chunk.completion

    async def complete(self, prompt: str, with_history: List[ChatMessage] = [], **kwargs) -> Coroutine[Any, Any, str]:
        args = {**self.default_args, **kwargs}

        messages = compile_chat_messages(
            args["model"], with_history, args["max_tokens"], prompt, functions=None)
        resp = (await self.anthropic.completions.create(
            model=args["model"],
            max_tokens_to_sample=args["max_tokens"],
            prompt=self.__messages_to_prompt(messages),
            **args
        )).completion

        return resp

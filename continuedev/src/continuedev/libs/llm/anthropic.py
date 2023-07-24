
from functools import cached_property
import time
from typing import Any, Coroutine, Dict, Generator, List, Union
from ...core.main import ChatMessage
from anthropic import HUMAN_PROMPT, AI_PROMPT, AsyncAnthropic
from ..llm import LLM
from ..util.count_tokens import DEFAULT_MAX_TOKENS, compile_chat_messages, CHAT_MODELS, DEFAULT_ARGS, count_tokens, prune_raw_prompt_from_top


class AnthropicLLM(LLM):
    api_key: str
    default_model: str
    async_client: AsyncAnthropic

    def __init__(self, api_key: str, default_model: str, system_message: str = None):
        self.api_key = api_key
        self.default_model = default_model
        self.system_message = system_message

        self.async_client = AsyncAnthropic(api_key=api_key)

    @cached_property
    def name(self):
        return self.default_model

    @property
    def default_args(self):
        return {**DEFAULT_ARGS, "model": self.default_model}

    def _transform_args(self, args: Dict[str, Any]) -> Dict[str, Any]:
        args = args.copy()
        if "max_tokens" in args:
            args["max_tokens_to_sample"] = args["max_tokens"]
            del args["max_tokens"]
        if "frequency_penalty" in args:
            del args["frequency_penalty"]
        if "presence_penalty" in args:
            del args["presence_penalty"]
        return args

    def count_tokens(self, text: str):
        return count_tokens(self.default_model, text)

    def __messages_to_prompt(self, messages: List[Dict[str, str]]) -> str:
        prompt = ""

        # Anthropic prompt must start with a Human turn
        if len(messages) > 0 and messages[0]["role"] != "user" and messages[0]["role"] != "system":
            prompt += f"{HUMAN_PROMPT} Hello."
        for msg in messages:
            prompt += f"{HUMAN_PROMPT if (msg['role'] == 'user' or msg['role'] == 'system') else AI_PROMPT} {msg['content']} "

        prompt += AI_PROMPT
        return prompt

    async def stream_complete(self, prompt, with_history: List[ChatMessage] = None, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.default_args.copy()
        args.update(kwargs)
        args["stream"] = True
        args = self._transform_args(args)

        async for chunk in await self.async_client.completions.create(
            prompt=f"{HUMAN_PROMPT} {prompt} {AI_PROMPT}",
            **args
        ):
            yield chunk.completion

    async def stream_chat(self, messages: List[ChatMessage] = None, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.default_args.copy()
        args.update(kwargs)
        args["stream"] = True
        args = self._transform_args(args)

        messages = compile_chat_messages(
            args["model"], messages, args["max_tokens_to_sample"], functions=args.get("functions", None), system_message=self.system_message)
        async for chunk in await self.async_client.completions.create(
            prompt=self.__messages_to_prompt(messages),
            **args
        ):
            yield {
                "role": "assistant",
                "content": chunk.completion
            }

    async def complete(self, prompt: str, with_history: List[ChatMessage] = None, **kwargs) -> Coroutine[Any, Any, str]:
        args = {**self.default_args, **kwargs}
        args = self._transform_args(args)

        messages = compile_chat_messages(
            args["model"], with_history, args["max_tokens_to_sample"], prompt, functions=None, system_message=self.system_message)
        resp = (await self.async_client.completions.create(
            prompt=self.__messages_to_prompt(messages),
            **args
        )).completion

        return resp

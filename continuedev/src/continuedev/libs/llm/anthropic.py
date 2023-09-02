from typing import Any, Coroutine, Dict, Generator, List, Union

from anthropic import AI_PROMPT, HUMAN_PROMPT, AsyncAnthropic

from ...core.main import ChatMessage
from ..llm import LLM
from ..util.count_tokens import compile_chat_messages


class AnthropicLLM(LLM):
    api_key: str
    "Anthropic API key"

    model: str = "claude-2"

    _async_client: AsyncAnthropic = None

    class Config:
        arbitrary_types_allowed = True

    async def start(
        self,
        **kwargs,
    ):
        await super().start(**kwargs)
        self._async_client = AsyncAnthropic(api_key=self.api_key)

        if self.model == "claude-2":
            self.context_length = 100_000

    def collect_args(self, **kwargs) -> Any:
        args = super().collect_args(**kwargs)

        if "max_tokens" in args:
            args["max_tokens_to_sample"] = args["max_tokens"]
            del args["max_tokens"]
        if "frequency_penalty" in args:
            del args["frequency_penalty"]
        if "presence_penalty" in args:
            del args["presence_penalty"]
        return args

    def __messages_to_prompt(self, messages: List[Dict[str, str]]) -> str:
        prompt = ""

        # Anthropic prompt must start with a Human turn
        if (
            len(messages) > 0
            and messages[0]["role"] != "user"
            and messages[0]["role"] != "system"
        ):
            prompt += f"{HUMAN_PROMPT} Hello."
        for msg in messages:
            prompt += f"{HUMAN_PROMPT if (msg['role'] == 'user' or msg['role'] == 'system') else AI_PROMPT} {msg['content']} "

        prompt += AI_PROMPT
        return prompt

    async def _stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.collect_args(**kwargs)
        args["stream"] = True
        prompt = f"{HUMAN_PROMPT} {prompt} {AI_PROMPT}"

        self.write_log(f"Prompt: \n\n{prompt}")
        completion = ""
        async for chunk in await self._async_client.completions.create(
            prompt=prompt, **args
        ):
            yield chunk.completion
            completion += chunk.completion

        self.write_log(f"Completion: \n\n{completion}")

    async def _stream_chat(
        self, messages: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        args = self.collect_args(**kwargs)
        args["stream"] = True

        messages = compile_chat_messages(
            args["model"],
            messages,
            self.context_length,
            args["max_tokens_to_sample"],
            functions=args.get("functions", None),
            system_message=self.system_message,
        )

        completion = ""
        prompt = self.__messages_to_prompt(messages)
        self.write_log(f"Prompt: \n\n{prompt}")
        async for chunk in await self._async_client.completions.create(
            prompt=prompt, **args
        ):
            yield {"role": "assistant", "content": chunk.completion}
            completion += chunk.completion

        self.write_log(f"Completion: \n\n{completion}")

    async def _complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ) -> Coroutine[Any, Any, str]:
        args = self.collect_args(**kwargs)

        messages = compile_chat_messages(
            args["model"],
            with_history,
            self.context_length,
            args["max_tokens_to_sample"],
            prompt,
            functions=None,
            system_message=self.system_message,
        )

        prompt = self.__messages_to_prompt(messages)
        self.write_log(f"Prompt: \n\n{prompt}")
        resp = (
            await self._async_client.completions.create(prompt=prompt, **args)
        ).completion

        self.write_log(f"Completion: \n\n{resp}")
        return resp

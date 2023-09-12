from typing import Any, Callable, Coroutine

from anthropic import AI_PROMPT, HUMAN_PROMPT, AsyncAnthropic

from ..llm import LLM, CompletionOptions
from .prompts.chat import anthropic_template_messages


class AnthropicLLM(LLM):
    """
    Import the `AnthropicLLM` class and set it as the default model:

    ```python
    from continuedev.src.continuedev.libs.llm.anthropic import AnthropicLLM

    config = ContinueConfig(
        ...
        models=Models(
            default=AnthropicLLM(api_key="<API_KEY>", model="claude-2")
        )
    )
    ```

    Claude 2 is not yet publicly released. You can request early access [here](https://www.anthropic.com/earlyaccess).

    """

    api_key: str
    "Anthropic API key"

    model: str = "claude-2"

    _async_client: AsyncAnthropic = None

    template_messages: Callable = anthropic_template_messages

    class Config:
        arbitrary_types_allowed = True

    async def start(self, **kwargs):
        await super().start(**kwargs)
        self._async_client = AsyncAnthropic(api_key=self.api_key)

        if self.model == "claude-2":
            self.context_length = 100_000

    def collect_args(self, options: CompletionOptions):
        options.stop = None
        args = super().collect_args(options)

        if "max_tokens" in args:
            args["max_tokens_to_sample"] = args["max_tokens"]
            del args["max_tokens"]
        if "frequency_penalty" in args:
            del args["frequency_penalty"]
        if "presence_penalty" in args:
            del args["presence_penalty"]
        return args

    async def _stream_complete(self, prompt: str, options):
        args = self.collect_args(options)
        prompt = f"{HUMAN_PROMPT} {prompt} {AI_PROMPT}"

        async for chunk in await self._async_client.completions.create(
            prompt=prompt, stream=True, **args
        ):
            yield chunk.completion

    async def _complete(self, prompt: str, options) -> Coroutine[Any, Any, str]:
        args = self.collect_args(options)
        prompt = f"{HUMAN_PROMPT} {prompt} {AI_PROMPT}"
        return (
            await self._async_client.completions.create(prompt=prompt, **args)
        ).completion

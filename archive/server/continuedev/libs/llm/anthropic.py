from typing import Any, Callable, Coroutine, Optional

from anthropic import AI_PROMPT, HUMAN_PROMPT, AsyncAnthropic

from .base import LLM, CompletionOptions
from .prompts.chat import anthropic_template_messages


class AnthropicLLM(LLM):
    """
    To setup Anthropic, add the following to your `config.json` file:

    ```json title="~/.continue/config.json"
    {
        "models": [{
            "title": "Anthropic",
            "provider": "anthropic",
            "model": "claude-2",
            "api_key": "YOUR_API_KEY"
        }]
    }
    ```

    Claude 2 is not yet publicly released. You can request early access [here](https://www.anthropic.com/earlyaccess).

    """

    api_key: Optional[str]
    "Anthropic API key"

    model: str = "claude-2"

    template_messages: Callable = anthropic_template_messages

    class Config:
        arbitrary_types_allowed = True

    def start(self, *args, **kwargs):
        super().start(*args, **kwargs)

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

        async for chunk in await AsyncAnthropic(
            api_key=self.api_key
        ).completions.create(prompt=prompt, stream=True, **args):
            yield chunk.completion

    async def _complete(self, prompt: str, options) -> Coroutine[Any, Any, str]:
        args = self.collect_args(options)
        prompt = f"{HUMAN_PROMPT} {prompt} {AI_PROMPT}"
        return (
            await AsyncAnthropic(api_key=self.api_key).completions.create(
                prompt=prompt, **args
            )
        ).completion

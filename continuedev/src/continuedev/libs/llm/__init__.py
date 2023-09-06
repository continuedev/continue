from typing import Any, Callable, Coroutine, Dict, Generator, List, Optional, Union

from pydantic import validator

from ...core.main import ChatMessage
from ...libs.util.devdata import dev_data_logger
from ...models.main import ContinueBaseModel
from ..util.count_tokens import (
    DEFAULT_ARGS,
    DEFAULT_MAX_TOKENS,
    compile_chat_messages,
    count_tokens,
    format_chat_messages,
    prune_raw_prompt_from_top,
)


class CompletionOptions(ContinueBaseModel):
    """Options for the completion."""

    @validator(
        "*",
        pre=True,
        always=True,
    )
    def ignore_none_and_set_default(cls, value, field):
        return value if value is not None else field.default

    model: str = None
    "The model name"
    temperature: Optional[float] = None
    "The temperature of the completion."

    top_p: Optional[float] = None
    "The top_p of the completion."

    top_k: Optional[int] = None
    "The top_k of the completion."

    presence_penalty: Optional[float] = None
    "The presence penalty of the completion."

    frequency_penalty: Optional[float] = None
    "The frequency penalty of the completion."

    stop: Optional[List[str]] = None
    "The stop tokens of the completion."

    max_tokens: int = DEFAULT_MAX_TOKENS
    "The maximum number of tokens to generate."

    functions: Optional[List[Any]] = None
    "The functions/tools to make available to the model."


class LLM(ContinueBaseModel):
    title: Optional[str] = None
    system_message: Optional[str] = None

    context_length: int = 2048
    "The maximum context length of the LLM in tokens, as counted by count_tokens."

    unique_id: Optional[str] = None
    "The unique ID of the user."

    model: str
    "The model name"

    timeout: Optional[int] = 300
    "The timeout for the request in seconds."

    prompt_templates: dict = {}

    template_messages: Optional[Callable[[List[Dict[str, str]]], str]] = None
    "A function that takes a list of messages and returns a prompt."

    write_log: Optional[Callable[[str], None]] = None
    "A function that takes a string and writes it to the log."

    api_key: Optional[str] = None
    "The API key for the LLM provider."

    class Config:
        arbitrary_types_allowed = True
        extra = "allow"

    def dict(self, **kwargs):
        original_dict = super().dict(**kwargs)
        original_dict.pop("write_log")
        original_dict.pop("template_messages")
        original_dict.pop("unique_id")
        original_dict["class_name"] = self.__class__.__name__
        return original_dict

    async def start(
        self, write_log: Callable[[str], None] = None, unique_id: Optional[str] = None
    ):
        """Start the connection to the LLM."""
        self.write_log = write_log
        self.unique_id = unique_id

    async def stop(self):
        """Stop the connection to the LLM."""
        pass

    def collect_args(self, options: CompletionOptions) -> Dict[str, Any]:
        """Collect the arguments for the LLM."""
        args = {**DEFAULT_ARGS.copy(), "model": self.model}
        args.update(options.dict(exclude_unset=True, exclude_none=True))
        return args

    def compile_chat_messages(
        self,
        options: CompletionOptions,
        msgs: List[ChatMessage],
        functions: Optional[List[Any]] = None,
    ) -> List[Dict]:
        return compile_chat_messages(
            model_name=options.model,
            msgs=msgs,
            context_length=self.context_length,
            max_tokens=options.max_tokens,
            functions=functions,
            system_message=self.system_message,
        )

    def template_prompt_like_messages(self, prompt: str) -> str:
        if self.template_messages is None:
            return prompt

        msgs = [{"role": "user", "content": prompt}]
        if self.system_message is not None:
            msgs.insert(0, {"role": "system", "content": self.system_message})

        return self.template_messages(msgs)

    async def stream_complete(
        self,
        prompt: str,
        model: str = None,
        temperature: float = None,
        top_p: float = None,
        top_k: int = None,
        presence_penalty: float = None,
        frequency_penalty: float = None,
        stop: Optional[List[str]] = None,
        max_tokens: Optional[int] = None,
        functions: Optional[List[Any]] = None,
    ) -> Generator[Union[Any, List, Dict], None, None]:
        """Yield completion response, either streamed or not."""
        options = CompletionOptions(
            model=model or self.model,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            presence_penalty=presence_penalty,
            frequency_penalty=frequency_penalty,
            stop=stop,
            max_tokens=max_tokens,
            functions=functions,
        )

        prompt = prune_raw_prompt_from_top(
            self.model, self.context_length, prompt, options.max_tokens
        )
        prompt = self.template_prompt_like_messages(prompt)

        self.write_log(f"Prompt: \n\n{prompt}")

        completion = ""
        async for chunk in self._stream_complete(prompt=prompt, options=options):
            yield chunk
            completion += chunk

        self.write_log(f"Completion: \n\n{completion}")
        dev_data_logger.capture(
            "tokens_generated",
            {"model": self.model, "tokens": self.count_tokens(completion)},
        )

    async def complete(
        self,
        prompt: str,
        model: str = None,
        temperature: float = None,
        top_p: float = None,
        top_k: int = None,
        presence_penalty: float = None,
        frequency_penalty: float = None,
        stop: Optional[List[str]] = None,
        max_tokens: Optional[int] = None,
        functions: Optional[List[Any]] = None,
    ) -> str:
        """Yield completion response, either streamed or not."""
        options = CompletionOptions(
            model=model or self.model,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            presence_penalty=presence_penalty,
            frequency_penalty=frequency_penalty,
            stop=stop,
            max_tokens=max_tokens,
            functions=functions,
        )

        prompt = prune_raw_prompt_from_top(
            self.model, self.context_length, prompt, options.max_tokens
        )
        prompt = self.template_prompt_like_messages(prompt)

        self.write_log(f"Prompt: \n\n{prompt}")

        completion = await self._complete(prompt=prompt, options=options)

        self.write_log(f"Completion: \n\n{completion}")
        dev_data_logger.capture(
            "tokens_generated",
            {"model": self.model, "tokens": self.count_tokens(completion)},
        )

        return completion

    async def stream_chat(
        self,
        messages: List[ChatMessage],
        model: str = None,
        temperature: float = None,
        top_p: float = None,
        top_k: int = None,
        presence_penalty: float = None,
        frequency_penalty: float = None,
        stop: Optional[List[str]] = None,
        max_tokens: Optional[int] = None,
        functions: Optional[List[Any]] = None,
    ) -> Generator[Union[Any, List, Dict], None, None]:
        """Yield completion response, either streamed or not."""
        options = CompletionOptions(
            model=model or self.model,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            presence_penalty=presence_penalty,
            frequency_penalty=frequency_penalty,
            stop=stop,
            max_tokens=max_tokens,
            functions=functions,
        )

        messages = self.compile_chat_messages(
            options=options, msgs=messages, functions=functions
        )
        if self.template_messages is not None:
            prompt = self.template_messages(messages)
        else:
            prompt = format_chat_messages(messages)

        self.write_log(f"Prompt: \n\n{prompt}")

        completion = ""

        # Use the template_messages function if it exists and do a raw completion
        if self.template_messages is None:
            async for chunk in self._stream_chat(messages=messages, options=options):
                yield chunk
                if "content" in chunk:
                    completion += chunk["content"]
        else:
            async for chunk in self._stream_complete(prompt=prompt, options=options):
                yield {"role": "assistant", "content": chunk}
                completion += chunk

        self.write_log(f"Completion: \n\n{completion}")
        dev_data_logger.capture(
            "tokens_generated",
            {"model": self.model, "tokens": self.count_tokens(completion)},
        )

    def _stream_complete(
        self, prompt, options: CompletionOptions
    ) -> Generator[str, None, None]:
        """Stream the completion through generator."""
        raise NotImplementedError

    async def _complete(
        self, prompt: str, options: CompletionOptions
    ) -> Coroutine[Any, Any, str]:
        """Return the completion of the text with the given temperature."""
        completion = ""
        async for chunk in self._stream_complete(prompt=prompt, options=options):
            completion += chunk
        return completion

    async def _stream_chat(
        self, messages: List[ChatMessage], options: CompletionOptions
    ) -> Generator[Union[Any, List, Dict], None, None]:
        """Stream the chat through generator."""
        if self.template_messages is None:
            raise NotImplementedError(
                "You must either implement template_messages or _stream_chat"
            )

        async for chunk in self._stream_complete(
            prompt=self.template_messages(messages), options=options
        ):
            yield {"role": "assistant", "content": chunk}

    def count_tokens(self, text: str):
        """Return the number of tokens in the given text."""
        return count_tokens(self.model, text)

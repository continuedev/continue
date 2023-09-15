from typing import Any, Callable, Coroutine, Dict, Generator, List, Optional, Union

from pydantic import Field, validator

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

    model: Optional[str] = Field(None, description="The model name")
    temperature: Optional[float] = Field(
        None, description="The temperature of the completion."
    )
    top_p: Optional[float] = Field(None, description="The top_p of the completion.")
    top_k: Optional[int] = Field(None, description="The top_k of the completion.")
    presence_penalty: Optional[float] = Field(
        None, description="The presence penalty of the completion."
    )
    frequency_penalty: Optional[float] = Field(
        None, description="The frequency penalty of the completion."
    )
    stop: Optional[List[str]] = Field(
        None, description="The stop tokens of the completion."
    )
    max_tokens: int = Field(
        DEFAULT_MAX_TOKENS, description="The maximum number of tokens to generate."
    )
    functions: Optional[List[Any]] = Field(
        None, description="The functions/tools to make available to the model."
    )


class LLM(ContinueBaseModel):
    title: Optional[str] = Field(
        None,
        description="A title that will identify this model in the model selection dropdown",
    )
    system_message: Optional[str] = Field(
        None, description="A system message that will always be followed by the LLM"
    )

    context_length: int = Field(
        2048,
        description="The maximum context length of the LLM in tokens, as counted by count_tokens.",
    )

    unique_id: Optional[str] = Field(None, description="The unique ID of the user.")
    model: str = Field(
        ..., description="The name of the model to be used (e.g. gpt-4, codellama)"
    )

    timeout: Optional[int] = Field(
        300,
        description="Set the timeout for each request to the LLM. If you are running a local LLM that takes a while to respond, you might want to set this to avoid timeouts.",
    )
    verify_ssl: Optional[bool] = Field(
        None, description="Whether to verify SSL certificates for requests."
    )
    ca_bundle_path: str = Field(
        None,
        description="Path to a custom CA bundle to use when making the HTTP request",
    )
    prompt_templates: dict = Field(
        {},
        description='A dictionary of prompt templates that can be used to customize the behavior of the LLM in certain situations. For example, set the "edit" key in order to change the prompt that is used for the /edit slash command. Each value in the dictionary is a string templated in mustache syntax, and filled in at runtime with the variables specific to the situation. See the documentation for more information.',
    )

    template_messages: Optional[Callable[[List[Dict[str, str]]], str]] = Field(
        None,
        description="A function that takes a list of messages and returns a prompt. This ensures that models like llama2, which are trained on specific chat formats, will always receive input in that format.",
    )
    write_log: Optional[Callable[[str], None]] = Field(
        None,
        description="A function that is called upon every prompt and completion, by default to log to the file which can be viewed by clicking on the magnifying glass.",
    )

    api_key: Optional[str] = Field(
        None, description="The API key for the LLM provider."
    )

    class Config:
        arbitrary_types_allowed = True
        extra = "allow"
        fields = {
            "title": {
                "description": "A title that will identify this model in the model selection dropdown"
            },
            "system_message": {
                "description": "A system message that will always be followed by the LLM"
            },
            "context_length": {
                "description": "The maximum context length of the LLM in tokens, as counted by count_tokens."
            },
            "unique_id": {"description": "The unique ID of the user."},
            "model": {
                "description": "The name of the model to be used (e.g. gpt-4, codellama)"
            },
            "timeout": {
                "description": "Set the timeout for each request to the LLM. If you are running a local LLM that takes a while to respond, you might want to set this to avoid timeouts."
            },
            "prompt_templates": {
                "description": 'A dictionary of prompt templates that can be used to customize the behavior of the LLM in certain situations. For example, set the "edit" key in order to change the prompt that is used for the /edit slash command. Each value in the dictionary is a string templated in mustache syntax, and filled in at runtime with the variables specific to the situation. See the documentation for more information.'
            },
            "template_messages": {
                "description": "A function that takes a list of messages and returns a prompt. This ensures that models like llama2, which are trained on specific chat formats, will always receive input in that format."
            },
            "write_log": {
                "description": "A function that is called upon every prompt and completion, by default to log to the file which can be viewed by clicking on the magnifying glass."
            },
            "api_key": {"description": "The API key for the LLM provider."},
            "verify_ssl": {
                "description": "Whether to verify SSL certificates for requests."
            },
        }

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
        raw: bool = False,
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

        if not raw:
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
        raw: bool = False,
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

        if not raw:
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

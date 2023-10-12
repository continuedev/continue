import ssl
from textwrap import dedent
from time import time
from typing import Any, Callable, Coroutine, Dict, Generator, List, Optional, Union

import aiohttp
import certifi
from pydantic import Field, validator

from ...core.main import ChatMessage
from ...models.main import ContinueBaseModel
from ..util.count_tokens import (
    DEFAULT_ARGS,
    DEFAULT_MAX_TOKENS,
    compile_chat_messages,
    count_tokens,
    format_chat_messages,
    prune_raw_prompt_from_top,
)
from ..util.devdata import dev_data_logger
from ..util.telemetry import posthog_logger


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
        None, description="The presence penalty Aof the completion."
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

class PromptTemplate(CompletionOptions):
    prompt: str = Field(description="The prompt to be used for the completion.")
    raw: bool = Field(False, description="Whether to use the raw prompt or not.")

class LLM(ContinueBaseModel):
    title: Optional[str] = Field(
        None,
        description="A title that will identify this model in the model selection dropdown",
    )

    unique_id: Optional[str] = Field(None, description="The unique ID of the user.")
    model: str = Field(
        ..., description="The name of the model to be used (e.g. gpt-4, codellama)"
    )

    system_message: Optional[str] = Field(
        None, description="A system message that will always be followed by the LLM"
    )

    context_length: int = Field(
        2048,
        description="The maximum context length of the LLM in tokens, as counted by count_tokens.",
    )

    stop_tokens: Optional[List[str]] = Field(
        None, description="Tokens that will stop the completion."
    )
    temperature: Optional[float] = Field(
        None, description="The temperature of the completion."
    )
    top_p: Optional[float] = Field(None, description="The top_p of the completion.")
    top_k: Optional[int] = Field(None, description="The top_k of the completion.")
    presence_penalty: Optional[float] = Field(
        None, description="The presence penalty Aof the completion."
    )
    frequency_penalty: Optional[float] = Field(
        None, description="The frequency penalty of the completion."
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
    proxy: Optional[str] = Field(
        None,
        description="Proxy URL to use when making the HTTP request",
    )
    headers: Optional[Dict[str, str]] = Field(
        None,
        description="Headers to use when making the HTTP request",
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
                "description": 'A dictionary of prompt templates that can be used to customize the behavior of the LLM in certain situations. For example, set the "edit" key in order to change the prompt that is used for the /edit slash command. Each value in the dictionary is a string templated in mustache syntax, and filled in at runtime with the variables specific to the situation OR an instance of the PromptTemplate class if you want to control other parameters. See the documentation for more information.'
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
            "ca_bundle_path": {
                "description": "Path to a custom CA bundle to use when making the HTTP request"
            },
            "headers": {
                "description": "Headers to use when making the HTTP request"
            },
            "proxy": {"description": "Proxy URL to use when making the HTTP request"},
            "stop_tokens": {"description": "Tokens that will stop the completion."},
            "temperature": {
                "description": "The sampling temperature used for generation."
            },
            "top_p": {
                "description": "The top_p sampling parameter used for generation."
            },
            "top_k": {
                "description": "The top_k sampling parameter used for generation."
            },
            "presence_penalty": {
                "description": "The presence penalty used for completions."
            },
            "frequency_penalty": {
                "description": "The frequency penalty used for completions."
            },
        }

    def dict(self, **kwargs):
        original_dict = super().dict(**kwargs)
        original_dict.pop("write_log")
        if self.template_messages is not None:
            original_dict["template_messages"] = self.template_messages.__name__
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

    _config_system_message: Optional[str] = None
    _config_temperature: Optional[float] = None

    def set_main_config_params(self, system_msg: str, temperature: float):
        self._config_system_message = system_msg
        self._config_temperature = temperature

    def create_client_session(self):
        if self.verify_ssl is False:
            return aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(verify_ssl=False),
                timeout=aiohttp.ClientTimeout(total=self.timeout),
                headers=self.headers
            )
        else:
            ca_bundle_path = (
                certifi.where() if self.ca_bundle_path is None else self.ca_bundle_path
            )
            ssl_context = ssl.create_default_context(cafile=ca_bundle_path)
            return aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(ssl_context=ssl_context),
                timeout=aiohttp.ClientTimeout(total=self.timeout),
                headers=self.headers,
            )

    def collect_args(self, options: CompletionOptions) -> Dict[str, Any]:
        """Collect the arguments for the LLM."""
        args = {**DEFAULT_ARGS.copy(), "model": self.model}
        args.update(options.dict(exclude_unset=True, exclude_none=True))
        return args
    
    def compile_log_message(self, prompt: str, completion_options: CompletionOptions) -> str:
        dict = completion_options.dict(exclude_unset=True, exclude_none=True)
        settings = "\n".join([f"{key}: {value}" for key, value in dict.items()])
        return f"""\
Settings:
{settings}

############################################

{prompt}"""
    
    def get_system_message(self) -> Optional[str]:
        return self.system_message if self.system_message is not None else self._config_system_message

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
            system_message=self.get_system_message(),
        )

    def template_prompt_like_messages(self, prompt: str) -> str:
        if self.template_messages is None:
            return prompt

        msgs = [{"role": "user", "content": prompt}]

        if self.get_system_message() is not None:
            msgs.insert(0, {"role": "system", "content": self.get_system_message()})

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
        log: bool = True,
    ) -> Generator[Union[Any, List, Dict], None, None]:
        """Yield completion response, either streamed or not."""
        options = CompletionOptions(
            model=model or self.model,
            temperature=temperature or self.temperature,
            top_p=top_p or self.top_p,
            top_k=top_k or self.top_k,
            presence_penalty=presence_penalty or self.presence_penalty,
            frequency_penalty=frequency_penalty or self.frequency_penalty,
            stop=stop or self.stop_tokens,
            max_tokens=max_tokens,
            functions=functions,
        )

        prompt = prune_raw_prompt_from_top(
            self.model, self.context_length, prompt, options.max_tokens
        )

        if not raw:
            prompt = self.template_prompt_like_messages(prompt)

        if log:
            self.write_log(self.compile_log_message(prompt, options))

        completion = ""
        async for chunk in self._stream_complete(prompt=prompt, options=options):
            yield chunk
            completion += chunk

        # if log:
        #     self.write_log(f"Completion: \n\n{completion}")

        dev_data_logger.capture(
            "tokens_generated",
            {"model": self.model, "tokens": self.count_tokens(completion)},
        )
        posthog_logger.capture_event(
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
        log: bool = True,
    ) -> str:
        """Yield completion response, either streamed or not."""
        options = CompletionOptions(
            model=model or self.model,
            temperature=temperature or self.temperature,
            top_p=top_p or self.top_p,
            top_k=top_k or self.top_k,
            presence_penalty=presence_penalty or self.presence_penalty,
            frequency_penalty=frequency_penalty or self.frequency_penalty,
            stop=stop or self.stop_tokens,
            max_tokens=max_tokens,
            functions=functions,
        )

        prompt = prune_raw_prompt_from_top(
            self.model, self.context_length, prompt, options.max_tokens
        )

        if not raw:
            prompt = self.template_prompt_like_messages(prompt)

        if log:
            self.write_log(self.compile_log_message(prompt, options))

        completion = await self._complete(prompt=prompt, options=options)

        # if log:
        #     self.write_log(f"Completion: \n\n{completion}")

        dev_data_logger.capture(
            "tokens_generated",
            {"model": self.model, "tokens": self.count_tokens(completion)},
        )
        posthog_logger.capture_event(
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
        log: bool = True,
    ) -> Generator[Union[Any, List, Dict], None, None]:
        """Yield completion response, either streamed or not."""
        options = CompletionOptions(
            model=model or self.model,
            temperature=temperature or self.temperature,
            top_p=top_p or self.top_p,
            top_k=top_k or self.top_k,
            presence_penalty=presence_penalty or self.presence_penalty,
            frequency_penalty=frequency_penalty or self.frequency_penalty,
            stop=stop or self.stop_tokens,
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

        if log:
            self.write_log(self.compile_log_message(prompt, options))

        completion = ""

        # Use the template_messages function if it exists and do a raw completion
        ti = time()
        tf = None
        if self.template_messages is None:
            async for chunk in self._stream_chat(messages=messages, options=options):
                yield chunk
                if "content" in chunk:
                    completion += chunk["content"]
                    if tf is None:
                        tf = time()
                        ttft = tf - ti
                        posthog_logger.capture_event("time_to_first_token", {
                            "model": self.model,
                            "model_class": self.__class__.__name__,
                            "time": ttft,
                            "tokens": sum(self.count_tokens(m["content"]) for m in messages)
                        })

        else:
            async for chunk in self._stream_complete(prompt=prompt, options=options):
                yield {"role": "assistant", "content": chunk}
                completion += chunk
                if tf is None:
                    tf = time()
                    ttft = tf - ti
                    posthog_logger.capture_event("time_to_first_token", {
                        "model": self.model,
                        "model_class": self.__class__.__name__,
                        "time": ttft,
                        "tokens": self.count_tokens(prompt)
                    })

        # if log:
        #     self.write_log(f"Completion: \n\n{completion}")

        dev_data_logger.capture(
            "tokens_generated",
            {"model": self.model, "tokens": self.count_tokens(completion)},
        )
        posthog_logger.capture_event(
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

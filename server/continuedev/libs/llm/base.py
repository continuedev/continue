import os
import ssl
from time import time
from typing import Any, AsyncGenerator, Callable, Coroutine, Dict, List, Optional

import aiohttp
import certifi
from pydantic import Field

from ...core.main import ChatMessage
from ...models.llm import BaseCompletionOptions, CompletionOptions, RequestOptions
from ...models.main import ContinueBaseModel
from ..util.count_tokens import (
    CONTEXT_LENGTH_FOR_MODEL,
    DEFAULT_ARGS,
    compile_chat_messages,
    count_tokens,
    format_chat_messages,
    prune_raw_prompt_from_top,
)
from ..util.devdata import dev_data_logger
from ..util.logging import logger
from ..util.telemetry import posthog_logger


class LLM(ContinueBaseModel):
    title: Optional[str] = Field(
        default=None,
        description="A title that will identify this model in the model selection dropdown",
    )

    unique_id: Optional[str] = Field(
        default=None, description="The unique ID of the user."
    )
    model: str = Field(
        default=...,
        description="The name of the model to be used (e.g. gpt-4, codellama)",
    )

    system_message: Optional[str] = Field(
        default=None,
        description="A system message that will always be followed by the LLM",
    )

    context_length: int = Field(
        default=2048,
        description="The maximum context length of the LLM in tokens, as counted by count_tokens.",
    )

    completion_options: BaseCompletionOptions = Field(
        default=BaseCompletionOptions(),
        description="Options for the completion endpoint. Read more about the completion options in the documentation.",
    )

    request_options: RequestOptions = Field(
        default=RequestOptions(),
        description="Options for the HTTP request to the LLM.",
    )

    prompt_templates: dict = Field(
        default={},
        description='A dictionary of prompt templates that can be used to customize the behavior of the LLM in certain situations. For example, set the "edit" key in order to change the prompt that is used for the /edit slash command. Each value in the dictionary is a string templated in mustache syntax, and filled in at runtime with the variables specific to the situation. See the documentation for more information.',
    )

    template_messages: Optional[Callable[[List[ChatMessage]], str]] = Field(
        default=None,
        description="A function that takes a list of messages and returns a prompt. This ensures that models like llama2, which are trained on specific chat formats, will always receive input in that format.",
    )
    write_log: Optional[Callable[[str], Coroutine]] = Field(
        default=None,
        description="A function that is called upon every prompt and completion, by default to log to the file which can be viewed by clicking on the magnifying glass.",
    )

    api_key: Optional[str] = Field(
        default=None, description="The API key for the LLM provider."
    )
    api_base: Optional[str] = Field(
        default=None, description="The base URL of the LLM API."
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
            "prompt_templates": {
                "description": 'A dictionary of prompt templates that can be used to customize the behavior of the LLM in certain situations. For example, set the "edit" key in order to change the prompt that is used for the /edit slash command. Each value in the dictionary is a string templated in mustache syntax, and filled in at runtime with the variables specific to the situation OR an instance of the PromptTemplate class if you want to control other parameters. See the documentation for more information.'
            },
            "template_messages": {
                "description": "A function that takes a list of messages and returns a prompt. This ensures that models like llama2, which are trained on specific chat formats, will always receive input in that format."
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

    def start(self, unique_id: Optional[str] = None):
        """Start the connection to the LLM."""
        self.unique_id = unique_id

    async def stop(self):
        """Stop the connection to the LLM."""
        pass

    _config_system_message: Optional[str] = None
    _config_temperature: Optional[float] = None

    def set_main_config_params(
        self, system_msg: Optional[str], temperature: Optional[float]
    ):
        self._config_system_message = system_msg
        self._config_temperature = temperature

    def create_client_session(self):
        if self.request_options.verify_ssl is False:
            return aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(verify_ssl=False),
                timeout=aiohttp.ClientTimeout(total=self.request_options.timeout),
                headers=self.request_options.headers,
                trust_env=True,
            )
        else:
            ca_bundle_path = (
                certifi.where()
                if self.request_options.ca_bundle_path is None
                else self.request_options.ca_bundle_path
            )
            if os.path.exists(ca_bundle_path):
                ssl_context = ssl.create_default_context(cafile=ca_bundle_path)
                return aiohttp.ClientSession(
                    connector=aiohttp.TCPConnector(ssl_context=ssl_context),
                    timeout=aiohttp.ClientTimeout(total=self.request_options.timeout),
                    headers=self.request_options.headers,
                    trust_env=True,
                )
            else:
                logger.warning(
                    "Could not find CA bundle at %s, using default SSL context",
                    ca_bundle_path,
                )
                return aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=self.request_options.timeout),
                    headers=self.request_options.headers,
                    trust_env=True,
                )

    def collect_args(self, options: CompletionOptions) -> Dict[str, Any]:
        """Collect the arguments for the LLM."""
        args = {**DEFAULT_ARGS.copy(), "model": self.model}
        args.update(options.dict(exclude_unset=True, exclude_none=True))
        return args

    def compile_log_message(
        self, prompt: str, completion_options: CompletionOptions
    ) -> str:
        dict = {"context_length": self.context_length}
        dict.update(completion_options.dict(exclude_unset=True, exclude_none=True))
        settings = "\n".join([f"{key}: {value}" for key, value in dict.items()])
        return f"""\
Settings:
{settings}

############################################

{prompt}"""

    def get_system_message(self) -> Optional[str]:
        return (
            self.system_message
            if self.system_message is not None
            else self._config_system_message
        )

    def compile_chat_messages(
        self,
        options: CompletionOptions,
        msgs: List[ChatMessage],
        functions: Optional[List[Any]] = None,
    ) -> List[ChatMessage]:
        # In case gpt-3.5-turbo-16k or something else is specified that has longer context_length
        context_length = self.context_length
        if options.model != self.model and options.model in CONTEXT_LENGTH_FOR_MODEL:
            context_length = CONTEXT_LENGTH_FOR_MODEL[options.model]

        return compile_chat_messages(
            model_name=options.model,
            msgs=msgs,
            context_length=context_length,
            max_tokens=options.max_tokens,
            functions=functions,
            system_message=self.get_system_message(),
        )

    def template_prompt_like_messages(self, prompt: str) -> str:
        if self.template_messages is None:
            return prompt

        msgs = [ChatMessage(role="user", content=prompt, summary=prompt)]

        if system_message := self.get_system_message():
            msgs.insert(
                0,
                ChatMessage(role="system", content=system_message, summary=""),
            )

        return self.template_messages(msgs)

    def log_tokens_generated(self, model: str, completion: str):
        tokens = self.count_tokens(completion)
        dev_data_logger.capture(
            "tokens_generated",
            {"model": model, "tokens": tokens},
        )
        posthog_logger.capture_event(
            "tokens_generated",
            {"model": model, "tokens": tokens},
        )

    async def stream_complete(
        self,
        prompt: str,
        raw: bool = False,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[int] = None,
        presence_penalty: Optional[float] = None,
        frequency_penalty: Optional[float] = None,
        stop: Optional[List[str]] = None,
        max_tokens: Optional[int] = None,
        functions: Optional[List[Any]] = None,
        log: bool = True,
    ) -> AsyncGenerator[str, None]:
        """Yield completion response, either streamed or not."""
        options = CompletionOptions(
            model=model or self.model,
            temperature=temperature or self.completion_options.temperature,
            top_p=top_p or self.completion_options.top_p,
            top_k=top_k or self.completion_options.top_k,
            presence_penalty=presence_penalty
            or self.completion_options.presence_penalty,
            frequency_penalty=frequency_penalty
            or self.completion_options.frequency_penalty,
            stop=stop or self.completion_options.stop,
            max_tokens=max_tokens or self.completion_options.max_tokens,
            functions=functions,
        )

        prompt = prune_raw_prompt_from_top(
            self.model, self.context_length, prompt, options.max_tokens
        )

        if not raw:
            prompt = self.template_prompt_like_messages(prompt)

        if log and self.write_log:
            await self.write_log(self.compile_log_message(prompt, options))

        completion = ""
        async for chunk in self._stream_complete(prompt=prompt, options=options):
            yield chunk
            completion += chunk

        # if log:
        #     self.write_log(f"Completion: \n\n{completion}")

        self.log_tokens_generated(options.model, completion)

    async def complete(
        self,
        prompt: str,
        raw: bool = False,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[int] = None,
        presence_penalty: Optional[float] = None,
        frequency_penalty: Optional[float] = None,
        stop: Optional[List[str]] = None,
        max_tokens: Optional[int] = None,
        functions: Optional[List[Any]] = None,
        log: bool = True,
    ) -> str:
        """Yield completion response, either streamed or not."""
        options = CompletionOptions(
            model=model or self.model,
            temperature=temperature or self.completion_options.temperature,
            top_p=top_p or self.completion_options.top_p,
            top_k=top_k or self.completion_options.top_k,
            presence_penalty=presence_penalty
            or self.completion_options.presence_penalty,
            frequency_penalty=frequency_penalty
            or self.completion_options.frequency_penalty,
            stop=stop or self.completion_options.stop,
            max_tokens=max_tokens or self.completion_options.max_tokens,
            functions=functions,
        )

        prompt = prune_raw_prompt_from_top(
            self.model, self.context_length, prompt, options.max_tokens
        )

        if not raw:
            prompt = self.template_prompt_like_messages(prompt)

        if log and self.write_log:
            await self.write_log(self.compile_log_message(prompt, options))

        completion = await self._complete(prompt=prompt, options=options)

        # if log:
        #     self.write_log(f"Completion: \n\n{completion}")

        self.log_tokens_generated(options.model, completion)

        return completion

    async def stream_chat(
        self,
        messages: List[ChatMessage],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[int] = None,
        presence_penalty: Optional[float] = None,
        frequency_penalty: Optional[float] = None,
        stop: Optional[List[str]] = None,
        max_tokens: Optional[int] = None,
        functions: Optional[List[Any]] = None,
        log: bool = True,
    ) -> AsyncGenerator[ChatMessage, None]:
        """Yield completion response, either streamed or not."""
        options = CompletionOptions(
            model=model or self.model,
            temperature=temperature or self.completion_options.temperature,
            top_p=top_p or self.completion_options.top_p,
            top_k=top_k or self.completion_options.top_k,
            presence_penalty=presence_penalty
            or self.completion_options.presence_penalty,
            frequency_penalty=frequency_penalty
            or self.completion_options.frequency_penalty,
            stop=stop or self.completion_options.stop,
            max_tokens=max_tokens or self.completion_options.max_tokens,
            functions=functions,
        )

        messages = self.compile_chat_messages(
            options=options, msgs=messages, functions=functions
        )
        if self.template_messages is not None:
            prompt = self.template_messages(messages)
        else:
            prompt = format_chat_messages(messages)

        if log and self.write_log:
            await self.write_log(self.compile_log_message(prompt, options))

        completion = ""

        # Use the template_messages function if it exists and do a raw completion
        ti = time()
        tf = None
        if self.template_messages is None:
            async for chunk in self._stream_chat(messages=messages, options=options):
                yield chunk
                if chunk.content:
                    completion += chunk.content
                    if tf is None:
                        tf = time()
                        ttft = tf - ti
                        posthog_logger.capture_event(
                            "time_to_first_token",
                            {
                                "model": self.model,
                                "model_class": self.__class__.__name__,
                                "time": ttft,
                                "tokens": sum(
                                    self.count_tokens(m.content or "") for m in messages
                                ),
                            },
                        )

        else:
            async for chunk in self._stream_complete(prompt=prompt, options=options):
                yield ChatMessage(role="assistant", content=chunk, summary=chunk)
                completion += chunk
                if tf is None:
                    tf = time()
                    ttft = tf - ti
                    posthog_logger.capture_event(
                        "time_to_first_token",
                        {
                            "model": self.model,
                            "model_class": self.__class__.__name__,
                            "time": ttft,
                            "tokens": self.count_tokens(prompt),
                        },
                    )

        # if log:
        #     self.write_log(f"Completion: \n\n{completion}")

        self.log_tokens_generated(options.model, completion)

    def _stream_complete(
        self, prompt, options: CompletionOptions
    ) -> AsyncGenerator[str, None]:
        """Stream the completion through generator."""
        raise NotImplementedError

    async def _complete(self, prompt: str, options: CompletionOptions) -> str:
        """Return the completion of the text with the given temperature."""
        completion = ""
        async for chunk in self._stream_complete(prompt=prompt, options=options):
            completion += chunk

        return completion

    async def _stream_chat(
        self, messages: List[ChatMessage], options: CompletionOptions
    ) -> AsyncGenerator[ChatMessage, None]:
        """Stream the chat through generator."""
        if self.template_messages is None:
            raise NotImplementedError(
                "You must either implement template_messages or _stream_chat"
            )

        async for chunk in self._stream_complete(
            prompt=self.template_messages(messages), options=options
        ):
            yield ChatMessage(role="assistant", content=chunk, summary=chunk)

    def count_tokens(self, text: str):
        """Return the number of tokens in the given text."""
        return count_tokens(text, self.model)

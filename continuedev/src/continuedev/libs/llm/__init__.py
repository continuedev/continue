from abc import ABC
from typing import Any, Callable, Coroutine, Dict, Generator, List, Optional, Union

from ...core.main import ChatMessage
from ...models.main import ContinueBaseModel
from ..util.count_tokens import DEFAULT_ARGS, count_tokens


class LLM(ContinueBaseModel, ABC):
    title: Optional[str] = None
    system_message: Optional[str] = None

    context_length: int = 2048
    "The maximum context length of the LLM in tokens, as counted by count_tokens."

    unique_id: Optional[str] = None
    "The unique ID of the user."

    model: str
    "The model name"

    prompt_templates: dict = {}

    write_log: Optional[Callable[[str], None]] = None
    "A function that takes a string and writes it to the log."

    api_key: Optional[str] = None
    "The API key for the LLM provider."

    class Config:
        arbitrary_types_allowed = True
        extra = "allow"

    def dict(self, **kwargs):
        original_dict = super().dict(**kwargs)
        original_dict.pop("write_log", None)
        original_dict["class_name"] = self.__class__.__name__
        return original_dict

    def collect_args(self, **kwargs) -> Any:
        """Collect the arguments for the LLM."""
        args = {**DEFAULT_ARGS.copy(), "model": self.model, "max_tokens": 1024}
        args.update(kwargs)
        return args

    async def start(
        self, write_log: Callable[[str], None] = None, unique_id: Optional[str] = None
    ):
        """Start the connection to the LLM."""
        self.write_log = write_log
        self.unique_id = unique_id

    async def stop(self):
        """Stop the connection to the LLM."""
        pass

    async def _complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ) -> Coroutine[Any, Any, str]:
        """Return the completion of the text with the given temperature."""
        raise NotImplementedError

    def _stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        """Stream the completion through generator."""
        raise NotImplementedError

    async def _stream_chat(
        self, messages: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        """Stream the chat through generator."""
        raise NotImplementedError

    def count_tokens(self, text: str):
        """Return the number of tokens in the given text."""
        return count_tokens(self.model, text)

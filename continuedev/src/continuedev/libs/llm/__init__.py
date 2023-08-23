from abc import ABC, abstractproperty
from typing import Any, Coroutine, Dict, Generator, List, Optional, Union

from ...core.main import ChatMessage
from ...models.main import ContinueBaseModel


class LLM(ContinueBaseModel, ABC):
    requires_api_key: Optional[str] = None
    requires_unique_id: bool = False
    requires_write_log: bool = False

    system_message: Optional[str] = None

    class Config:
        arbitrary_types_allowed = True
        extra = "allow"

    def dict(self, **kwargs):
        original_dict = super().dict(**kwargs)
        original_dict.pop("write_log", None)
        original_dict["name"] = self.name
        original_dict["class_name"] = self.__class__.__name__
        return original_dict

    @abstractproperty
    def name(self):
        """Return the name of the LLM."""
        raise NotImplementedError

    async def start(self, *, api_key: Optional[str] = None, **kwargs):
        """Start the connection to the LLM."""
        raise NotImplementedError

    async def stop(self):
        """Stop the connection to the LLM."""
        raise NotImplementedError

    async def complete(
        self, prompt: str, with_history: List[ChatMessage] = None, **kwargs
    ) -> Coroutine[Any, Any, str]:
        """Return the completion of the text with the given temperature."""
        raise NotImplementedError

    def stream_complete(
        self, prompt, with_history: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        """Stream the completion through generator."""
        raise NotImplementedError

    async def stream_chat(
        self, messages: List[ChatMessage] = None, **kwargs
    ) -> Generator[Union[Any, List, Dict], None, None]:
        """Stream the chat through generator."""
        raise NotImplementedError

    def count_tokens(self, text: str):
        """Return the number of tokens in the given text."""
        raise NotImplementedError

    @abstractproperty
    def context_length(self) -> int:
        """Return the context length of the LLM in tokens, as counted by count_tokens."""
        raise NotImplementedError

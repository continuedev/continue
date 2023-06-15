from abc import ABC
from typing import Any, Dict, Generator, List, Union

from ...core.main import ChatMessage
from ...models.main import AbstractModel
from pydantic import BaseModel


class LLM(ABC):
    system_message: Union[str, None] = None

    def complete(self, prompt: str, with_history: List[ChatMessage] = [], **kwargs):
        """Return the completion of the text with the given temperature."""
        raise

    def stream_chat(self, prompt, with_history: List[ChatMessage] = [], **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        """Yield a stream of chat messages."""
        raise NotImplementedError

    def __call__(self, prompt: str, **kwargs):
        return self.complete(prompt, **kwargs)

    def with_system_message(self, system_message: Union[str, None]):
        """Return a new model with the given system message."""
        raise NotImplementedError

    def count_tokens(self, text: str):
        """Return the number of tokens in the given text."""
        raise NotImplementedError

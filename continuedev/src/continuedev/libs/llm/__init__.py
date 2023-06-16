from abc import ABC
from typing import Any, Coroutine, Dict, Generator, List, Union

from ...core.main import ChatMessage
from ...models.main import AbstractModel
from pydantic import BaseModel


class LLM(ABC):
    system_message: Union[str, None] = None

    async def complete(self, prompt: str, with_history: List[ChatMessage] = [], **kwargs) -> Coroutine[Any, Any, str]:
        """Return the completion of the text with the given temperature."""
        raise NotImplementedError

    def stream_chat(self, prompt, with_history: List[ChatMessage] = [], **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        """Yield a stream of chat messages."""
        raise NotImplementedError

    def with_system_message(self, system_message: Union[str, None]):
        """Return a new model with the given system message."""
        raise NotImplementedError

    def count_tokens(self, text: str):
        """Return the number of tokens in the given text."""
        raise NotImplementedError

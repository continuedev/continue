from abc import ABC
from typing import Any, Coroutine, Dict, Generator, List, Union

from ...core.main import ChatMessage
from ...models.main import AbstractModel
from pydantic import BaseModel


class LLM(ABC):
    required_api_key: Optional[str] = None
    system_message: Union[str, None] = None

    async def start(self, *, api_key: Optional[str] = None):
        """Start the connection to the LLM."""
        raise NotImplementedError

    async def stop(self):
        """Stop the connection to the LLM."""
        raise NotImplementedError

    async def complete(self, prompt: str, with_history: List[ChatMessage] = None, **kwargs) -> Coroutine[Any, Any, str]:
        """Return the completion of the text with the given temperature."""
        raise NotImplementedError

    def stream_complete(self, prompt, with_history: List[ChatMessage] = None, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        """Stream the completion through generator."""
        raise NotImplementedError

    async def stream_chat(self, messages: List[ChatMessage] = None, **kwargs) -> Generator[Union[Any, List, Dict], None, None]:
        """Stream the chat through generator."""
        raise NotImplementedError

    def count_tokens(self, text: str):
        """Return the number of tokens in the given text."""
        raise NotImplementedError

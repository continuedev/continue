from typing import Union
from ...models.main import AbstractModel
from pydantic import BaseModel


class LLM(BaseModel):
    system_message: Union[str, None] = None

    def complete(self, prompt: str, **kwargs):
        """Return the completion of the text with the given temperature."""
        raise

    def __call__(self, prompt: str, **kwargs):
        return self.complete(prompt, **kwargs)

    def fine_tune(self, pairs: list):
        """Fine tune the model on the given prompt/completion pairs."""
        raise NotImplementedError

    def with_system_message(self, system_message: Union[str, None]):
        """Return a new model with the given system message."""
        raise NotImplementedError

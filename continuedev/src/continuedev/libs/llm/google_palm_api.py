from typing import Callable, Dict, List, Union

from ...core.main import ChatMessage
from ..llm import LLM
from pydantic import Field
import requests


class GooglePaLMAPI(LLM):
    """
    The Google PaLM API is currently in public preview, so production applications are not supported yet. However, you can [create an API key in Google MakerSuite](https://makersuite.google.com/u/2/app/apikey) and begin trying out the `chat-bison-001` model. Change `~/.continue/config.py` to look like this:

    ```python
    from continuedev.src.continuedev.core.models import Models
    from continuedev.src.continuedev.libs.llm.hf_inference_api import GooglePaLMAPI

    config = ContinueConfig(
        ...
        models=Models(
            default=GooglePaLMAPI(
                model="chat-bison-001"
                api_key="<MAKERSUITE_API_KEY>",
        )
    )
    ```
    """

    api_key: str = Field(..., description="Google PaLM API key")

    model: str = "chat-bison-001"
    
    async def _stream_complete(self, prompt, options):

        api_url =  f"https://generativelanguage.googleapis.com/v1beta2/models/{self.model}:generateMessage?key={self.api_key}"
        body = { "prompt": { "messages": [{ "content": prompt}] } }
        response = requests.post(api_url, json=body)
        yield response.json()["candidates"][0]["content"]
    
    async def _stream_chat(self, messages: List[ChatMessage], options):

        msg_lst = []
        for message in messages:
            msg_lst.append({ "content": message["content"] })

        api_url =  f"https://generativelanguage.googleapis.com/v1beta2/models/{self.model}:generateMessage?key={self.api_key}"
        body = { "prompt": { "messages": msg_lst } }
        response = requests.post(api_url, json=body)
        yield {"content": response.json()["candidates"][0]["content"], "role": "assistant"}
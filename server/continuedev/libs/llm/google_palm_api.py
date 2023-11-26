from typing import List

import requests
from pydantic import Field

from ...core.main import ChatMessage
from .base import LLM


class GooglePaLMAPI(LLM):
    """
    The Google PaLM API is currently in public preview, so production applications are not supported yet. However, you can [create an API key in Google MakerSuite](https://makersuite.google.com/u/2/app/apikey) and begin trying out the `chat-bison-001` model. Change `~/.continue/config.json` to look like this:

    ```json title="~/.continue/config.json"
    {
        "models": [{
            "title": "Chat Bison",
            "provider": "google-palm",
            "model": "chat-bison-001",
            "api_key": "YOUR_API_KEY"
        }]
    }
    ```
    """

    api_key: str = Field(..., description="Google PaLM API key")

    model: str = "chat-bison-001"

    async def _stream_complete(self, prompt, options):
        api_url = f"https://generativelanguage.googleapis.com/v1beta2/models/{self.model}:generateMessage?key={self.api_key}"
        body = {"prompt": {"messages": [{"content": prompt}]}}
        response = requests.post(api_url, json=body)
        yield response.json()["candidates"][0]["content"]

    async def _stream_chat(self, messages: List[ChatMessage], options):
        msg_lst = []
        for message in messages:
            msg_lst.append({"content": message.content})

        api_url = f"https://generativelanguage.googleapis.com/v1beta2/models/{self.model}:generateMessage?key={self.api_key}"
        body = {"prompt": {"messages": msg_lst}}
        response = requests.post(api_url, json=body)
        yield ChatMessage(
            role="assistant", content=response.json()["candidates"][0]["content"]
        )

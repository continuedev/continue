from typing import List
from ...core.main import ChatMessage
from ..llm import LLM
import requests

DEFAULT_MAX_TOKENS = 2048
DEFAULT_MAX_TIME = 120.


class HuggingFaceInferenceAPI(LLM):
    api_key: str
    model: str

    def __init__(self, api_key: str, model: str, system_message: str = None):
        self.api_key = api_key
        self.model = model
        self.system_message = system_message  # TODO: Nothing being done with this

    def complete(self, prompt: str, with_history: List[ChatMessage] = None, **kwargs):
        """Return the completion of the text with the given temperature."""
        API_URL = f"https://api-inference.huggingface.co/models/{self.model}"
        headers = {
            "Authorization": f"Bearer {self.api_key}"}

        response = requests.post(API_URL, headers=headers, json={
            "inputs": prompt, "parameters": {
                "max_new_tokens": DEFAULT_MAX_TOKENS,
                "max_time": DEFAULT_MAX_TIME,
                "return_full_text": False,
            }
        })
        data = response.json()

        # Error if the response is not a list
        if not isinstance(data, list):
            raise Exception(
                "Hugging Face returned an error response: \n\n", data)

        return data[0]["generated_text"]

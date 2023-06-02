from ..llm import LLM
import requests

DEFAULT_MAX_TOKENS = 2048
DEFAULT_MAX_TIME = 120.


class HuggingFaceInferenceAPI(LLM):
    api_key: str
    model: str = "bigcode/starcoder"

    def complete(self, prompt: str, **kwargs):
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
        return response.json()[0]["generated_text"]

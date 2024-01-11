from typing import Optional

from huggingface_hub import InferenceClient
from pydantic import Field

from .base import LLM, CompletionOptions


class HuggingFaceInferenceAPI(LLM):
    """
    Hugging Face Inference API is a great option for newly released language models. Sign up for an account and add billing [here](https://huggingface.co/settings/billing), access the Inference Endpoints [here](https://ui.endpoints.huggingface.co), click on “New endpoint”, and fill out the form (e.g. select a model like [WizardCoder-Python-34B-V1.0](https://huggingface.co/WizardLM/WizardCoder-Python-34B-V1.0)), and then deploy your model by clicking “Create Endpoint”. Change `~/.continue/config.json` to look like this:

    ```json title="~/.continue/config.json"
    {
        "models": [{
            "title": "Hugging Face Inference API",
            "provider": "huggingface-inference-api",
            "model": "MODEL_NAME",
            "api_key": "YOUR_HF_TOKEN",
            "api_base": "INFERENCE_API_ENDPOINT_URL"
        }]
    }
    ```
    """

    model: str = Field(
        "Hugging Face Inference API",
        description="The name of the model to use (optional for the HuggingFaceInferenceAPI class)",
    )
    api_key: str = Field(..., description="Your Hugging Face API token")
    api_base: Optional[str] = Field(
        None, description="Your Hugging Face Inference API endpoint URL"
    )

    class Config:
        arbitrary_types_allowed = True

    def collect_args(self, options: CompletionOptions):
        options.stop = None
        args = super().collect_args(options)

        if "max_tokens" in args:
            args["max_new_tokens"] = args["max_tokens"]
            del args["max_tokens"]
        if "stop" in args:
            args["stop_sequences"] = args["stop"]
            del args["stop"]

        return args

    async def _stream_complete(self, prompt, options):
        args = self.collect_args(options)

        client = InferenceClient(self.api_base, token=self.api_key)

        stream = client.text_generation(prompt, stream=True, details=True, **args)

        for r in stream:
            # skip special tokens
            if r.token.special:
                continue
            # stop if we encounter a stop sequence
            if options.stop is not None:
                if r.token.text in options.stop:
                    break
            yield r.token.text

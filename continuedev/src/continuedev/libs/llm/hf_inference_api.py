from typing import Callable, Dict, List, Union

from huggingface_hub import InferenceClient
from pydantic import Field

from ..llm import LLM, CompletionOptions
from .prompts.chat import llama2_template_messages
from .prompts.edit import simplified_edit_prompt


class HuggingFaceInferenceAPI(LLM):
    """
    Hugging Face Inference API is a great option for newly released language models. Sign up for an account and add billing [here](https://huggingface.co/settings/billing), access the Inference Endpoints [here](https://ui.endpoints.huggingface.co), click on “New endpoint”, and fill out the form (e.g. select a model like [WizardCoder-Python-34B-V1.0](https://huggingface.co/WizardLM/WizardCoder-Python-34B-V1.0)), and then deploy your model by clicking “Create Endpoint”. Change `~/.continue/config.py` to look like this:

    ```python
    from continuedev.src.continuedev.core.models import Models
    from continuedev.src.continuedev.libs.llm.hf_inference_api import HuggingFaceInferenceAPI

    config = ContinueConfig(
        ...
        models=Models(
            default=HuggingFaceInferenceAPI(
                endpoint_url: "<INFERENCE_API_ENDPOINT_URL>",
                hf_token: "<HUGGING_FACE_TOKEN>",
        )
    )
    ```
    """

    model: str = Field(
        "Hugging Face Inference API",
        description="The name of the model to use (optional for the HuggingFaceInferenceAPI class)",
    )
    hf_token: str = Field(..., description="Your Hugging Face API token")
    endpoint_url: str = Field(
        None, description="Your Hugging Face Inference API endpoint URL"
    )

    template_messages: Union[
        Callable[[List[Dict[str, str]]], str], None
    ] = llama2_template_messages

    prompt_templates = {
        "edit": simplified_edit_prompt,
    }

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
        if "model" in args:
            del args["model"]
        return args

    async def _stream_complete(self, prompt, options):
        self.collect_args(options)

        client = InferenceClient(self.endpoint_url, token=self.hf_token)

        stream = client.text_generation(prompt, stream=True, details=True)

        for r in stream:
            # skip special tokens
            if r.token.special:
                continue
            # stop if we encounter a stop sequence
            if options.stop is not None:
                if r.token.text in options.stop:
                    break
            yield r.token.text

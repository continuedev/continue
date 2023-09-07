from typing import Callable, Dict, List
from ..llm import LLM, CompletionOptions

from huggingface_hub import InferenceClient
from .prompts.chat import llama2_template_messages
from .prompts.edit import simplified_edit_prompt


class HuggingFaceInferenceAPI(LLM):
    model: str = "Hugging Face Inference API"
    hf_token: str
    endpoint_url: str = None

    template_messages: Callable[[List[Dict[str, str]]], str] | None = llama2_template_messages

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
        args = self.collect_args(options)

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
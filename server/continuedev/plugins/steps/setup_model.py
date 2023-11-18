from ...core.main import SetStep, Step
from ...core.sdk import ContinueSDK
from ...libs.util.paths import getConfigFilePath

MODEL_CLASS_TO_MESSAGE = {
    "OpenAI": "Obtain your OpenAI API key from [here](https://platform.openai.com/account/api-keys) and paste it into the `api_key` field at config.models.default.api_key in `config.py`. Then reload the VS Code window for changes to take effect.",
    "OpenAIFreeTrial": "To get started with OpenAI models, obtain your OpenAI API key from [here](https://platform.openai.com/account/api-keys) and paste it into the `api_key` field at config.models.default.api_key in `config.py`. Then reload the VS Code window for changes to take effect.",
    "AnthropicLLM": "To get started with Anthropic, you first need to sign up for the beta [here](https://claude.ai/login) to obtain an API key. Once you have the key, paste it into the `api_key` field at config.models.default.api_key in `config.py`. Then reload the VS Code window for changes to take effect.",
    "ReplicateLLM": "To get started with Replicate, sign up to obtain an API key [here](https://replicate.ai/), then paste it into the `api_key` field at config.models.default.api_key in `config.py`.",
    "Ollama": "To get started with Ollama, download the app from [ollama.ai](https://ollama.ai/). Once it is downloaded, be sure to pull at least one model and use its name in the model field in config.py (e.g. `model='codellama'`).",
    "GGML": "GGML models can be run locally using the `llama-cpp-python` library. To learn how to set up a local llama-cpp-python server, read [here](https://github.com/continuedev/ggml-server-example). Once it is started on port 8000, you're all set!",
    "TogetherLLM": "To get started using models from Together, first obtain your Together API key from [here](https://together.ai). Paste it into the `api_key` field at config.models.default.api_key in `config.py`. Then, on their models page, press 'start' on the model of your choice and make sure the `model=` parameter in the config file for the `TogetherLLM` class reflects the name of this model. Finally, reload the VS Code window for changes to take effect.",
    "LlamaCpp": "To get started with this model, clone the [`llama.cpp` repo](https://github.com/ggerganov/llama.cpp) and follow the instructions to set up the server [here](https://github.com/ggerganov/llama.cpp/blob/master/examples/server/README.md#build). Any of the parameters described in the README can be passed to the `llama_cpp_args` field in the `LlamaCpp` class in `config.py`.",
    "HuggingFaceInferenceAPI": "To get started with the HuggingFace Inference API, first deploy a model and obtain your API key from [here](https://huggingface.co/inference-api). Paste it into the `hf_token` field at config.models.default.hf_token in `config.py`. Finally, reload the VS Code window for changes to take effect.",
    "GooglePaLMAPI": "To get started with the Google PaLM API, create an API key in Makersuite [here](https://makersuite.google.com/u/2/app/apikey), then paste it into the `api_key` field at config.models.default.api_key in `config.py`.",
}


class SetupModelStep(Step):
    model_class: str
    name: str = "Setup model in config.py"
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        await sdk.ide.setFileOpen(getConfigFilePath(json=True))
        yield SetStep(
            description=MODEL_CLASS_TO_MESSAGE.get(
                self.model_class, "Please finish setting up this model in `config.py`"
            )
        )

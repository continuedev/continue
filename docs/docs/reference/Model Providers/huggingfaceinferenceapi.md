# HuggingFace Inference Endpoints

Hugging Face Inference Endpoints are an easy way to setup instances of open-source language models on any cloud. Sign up for an account and add billing [here](https://huggingface.co/settings/billing), access the Inference Endpoints [here](https://ui.endpoints.huggingface.co), click on “New endpoint”, and fill out the form (e.g. select a model like [WizardCoder-Python-34B-V1.0](https://huggingface.co/WizardLM/WizardCoder-Python-34B-V1.0)), and then deploy your model by clicking “Create Endpoint”. Change `~/.continue/config.json` to look like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Hugging Face Inference API",
      "provider": "huggingface-inference-api",
      "model": "MODEL_NAME",
      "apiKey": "YOUR_HF_TOKEN",
      "apiBase": "INFERENCE_API_ENDPOINT_URL"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/HuggingFaceInferenceAPI.ts)

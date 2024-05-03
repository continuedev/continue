# HuggingFace 推理端点

Hugging Face 推理端点是一种在任何云上设置开源语言模型的简单方式。注册一个帐号，添加账单 [这里](https://huggingface.co/settings/billing) ，访问推理端点 [这里](https://ui.endpoints.huggingface.co) ，点击 "New endpoint" ， 填写表单（例如，选择一个模型，比如 [WizardCoder-Python-34B-V1.0](https://huggingface.co/WizardLM/WizardCoder-Python-34B-V1.0)），然后通过点击 "Create Endpoint" 部署你的模型。修改 `~/.continue/config.json` 看起来像这样：

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

[查看源码](https://github.com/continuedev/continue/blob/main/core/llm/llms/HuggingFaceInferenceAPI.ts)

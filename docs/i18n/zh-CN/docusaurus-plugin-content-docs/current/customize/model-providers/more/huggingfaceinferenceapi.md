# HuggingFace 推理端点

Hugging Face 推理端点是一个在任何云上设置开源语言模型实例的简单的方式。在 [这里](https://huggingface.co/settings/billing)注册帐号并添加账单 , 在 [这里](https://ui.endpoints.huggingface.co) 访问推理端点，点击 "New endpoint" ，并填写表单，(例如，选择一个模型 [WizardCoder-Python-34B-V1.0](https://huggingface.co/WizardLM/WizardCoder-Python-34B-V1.0)) ，然后通过点击 "Create Endpoint" 部署你的模型。修改 `~/.continue/config.json` 像这样：

```json title="config.json"
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

[查看代码](https://github.com/continuedev/continue/blob/main/core/llm/llms/HuggingFaceInferenceAPI.ts)

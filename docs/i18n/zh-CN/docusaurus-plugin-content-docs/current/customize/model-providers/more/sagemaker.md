# AWS SageMaker

SageMaker 可以用于聊天和嵌入模型。聊天模型由 [LMI](https://docs.djl.ai/docs/serving/serving/docs/lmi/index.html) 部署的端点支持，嵌入模型由 [HuggingFace TEI](https://huggingface.co/blog/sagemaker-huggingface-embedding) 部署的端点支持


为了设置 SageMaker 作为聊天模型提供者，添加以下到你的 `config.json` 文件中：

```json title="config.json"
{
  "models": [
    {
      "title": "deepseek-6.7b-instruct",
      "provider": "sagemaker",
      "model": "lmi-model-deepseek-coder-xxxxxxx",
      "region": "us-west-2"
    }
  ],
    "embeddingsProvider": {
    "provider": "sagemaker",
    "model": "mxbai-embed-large-v1-endpoint"
  },
}
```

模型中的值是你部署的 SageMaker 端点名称。

认证可以通过临时的或长期的证书，在 `~/.aws/credentials` 中名为 "sagemaker" 的属性中设置。

```title="~/.aws/credentials
[sagemaker]
aws_access_key_id = abcdefg
aws_secret_access_key = hijklmno
aws_session_token = pqrstuvwxyz # Optional: means short term creds.
```

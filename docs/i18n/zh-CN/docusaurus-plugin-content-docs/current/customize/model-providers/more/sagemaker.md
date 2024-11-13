# AWS SageMaker

SageMaker 提供者支持使用 [LMI](https://docs.djl.ai/docs/serving/serving/docs/lmi/index.html) 部署的 SageMaker 端点。

为了设置 SageMaker ，添加以下到你的 `config.json` 文件中：

```json title="config.json"
{
  "models": [
    {
      "title": "deepseek-6.7b-instruct",
      "provider": "sagemaker",
      "model": "lmi-model-deepseek-coder-xxxxxxx",
      "region": "us-west-2"
    }
  ]
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

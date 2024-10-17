# AWS SageMaker

SageMaker can be used for both chat and embedding models. Chat models are supported for endpoints deployed with [LMI](https://docs.djl.ai/docs/serving/serving/docs/lmi/index.html), and embedding models are supported for endpoints deployed with [HuggingFace TEI](https://huggingface.co/blog/sagemaker-huggingface-embedding)

To setup SageMaker as a chat model provider, add the following to your `config.json` file:

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

The value in model should be the SageMaker endpoint name you deployed.

Authentication will be through temporary or long-term credentials in
~/.aws/credentials under a profile called "sagemaker".

```title="~/.aws/credentials
[sagemaker]
aws_access_key_id = abcdefg
aws_secret_access_key = hijklmno
aws_session_token = pqrstuvwxyz # Optional: means short term creds.
```

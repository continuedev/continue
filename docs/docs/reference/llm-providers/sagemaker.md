# AWS SageMaker 

SageMaker provider support SageMaker endpoint deployed with [LMI](https://docs.djl.ai/docs/serving/serving/docs/lmi/index.html)

To setup SageMaker, add the following to your `config.json` file:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "deepseek-6.7b-instruct",
      "provider": "sagemaker",
      "model": "lmi-model-deepseek-coder-xxxxxxx",
      "region": "us-west-2"
    },
  ]
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

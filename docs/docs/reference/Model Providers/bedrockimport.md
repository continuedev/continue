# AWS Bedrock Custom Imported Models

To setup Bedrock using custom imported models, add the following to your `config.json` file:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "AWS Bedrock deepseek-coder-6.7b-instruct",
      "provider": "bedrockimport",
      "model": "deepseek-coder-6.7b-instruct",
      "modelArn": "arn:aws:bedrock:us-west-2:XXXXX:imported-model/XXXXXX",
      "region": "us-west-2",
      "profile": "bedrock"
    }
  ]
}
```

Authentication will be through temporary or long-term credentials in
~/.aws/credentials under a configured profile (e.g. "bedrock").

```title="~/.aws/credentials
[bedrock]
aws_access_key_id = abcdefg
aws_secret_access_key = hijklmno
aws_session_token = pqrstuvwxyz # Optional: means short term creds.
```

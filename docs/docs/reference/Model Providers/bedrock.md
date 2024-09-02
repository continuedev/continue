# Amazon Bedrock

To setup Bedrock, add the following to your `config.json` file:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "Bedrock: Claude 3.5 Sonnet",
      "provider": "bedrock",
      "model": "anthropic.claude-3-5-sonnet-20240620-v1:0",
      "region": "us-east-1",
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

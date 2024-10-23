---
title: Amazon Bedrock
slug: ../bedrock
---

Amazon Bedrock is a fully managed service on AWS that provides access to foundation models from various AI companies through a single API.

## Chat model

We recommend configuring **Claude 3.5 Sonnet** as your chat model.

```json title="config.json"
{
  "models": [
    {
      "title": "Claude 3.5 Sonnet",
      "provider": "bedrock",
      "model": "anthropic.claude-3-5-sonnet-20240620-v1:0",
      "region": "us-east-1",
      "profile": "bedrock"
    }
  ]
}
```

## Autocomplete model

Bedrock currently does not offer any autocomplete models.

[Click here](../../model-types/autocomplete.md) to see a list of autocomplete model providers.

## Embeddings model

We recommend configuring [`amazon.titan-embed-text-v2:0`](https://docs.aws.amazon.com/bedrock/latest/devguide/models.html#amazon.titan-embed-text-v2-0) as your embeddings model.

```json title="~/.continue/config.json"
{
  "embeddingsProvider": {
    "title": "Embeddings Model",
    "provider": "bedrock",
    "model": "amazon.titan-embed-text-v2:0",
    "region": "us-west-2"
  }
}
```

## Reranking model

Bedrock currently does not offer any reranking models.

[Click here](../../model-types/reranking.md) to see a list of reranking model providers.

## Authentication

Authentication will be through temporary or long-term credentials in
`~/.aws/credentials` under a configured profile (e.g. "bedrock").

```title="~/.aws/credentials
[bedrock]
aws_access_key_id = abcdefg
aws_secret_access_key = hijklmno
aws_session_token = pqrstuvwxyz # Optional: means short term creds.
```

## Custom Imported Models

To setup Bedrock using custom imported models, add the following to your `config.json` file:

```json title="config.json"
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

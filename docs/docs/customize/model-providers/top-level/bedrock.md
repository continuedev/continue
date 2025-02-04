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
> If you run into the following error when connecting to the new Claude 3.5 Sonnet 2 models from AWS - `400 Invocation of model ID anthropic.claude-3-5-sonnet-20241022-v2:0 with on-demand throughput isn’t supported. Retry your request with the ID or ARN of an inference profile that contains this model.`

> You can fix this using the following config.json
```json title="config.json"
{
  "models": [
    {
      "title": "Claude 3.5 Sonnet",
      "provider": "bedrock",
      "model": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
      "region": "us-east-1",
      "profile": "bedrock"
    }
  ]
}
```

## Autocomplete model

Bedrock currently does not offer any autocomplete models. However, [Codestral from Mistral](https://mistral.ai/news/codestral-2501/) and [Point from Poolisde](https://aws.amazon.com/bedrock/poolside/) will be supported in the near future.

In the meantime, you can view a list of autocomplete model providers [here](../../model-types/autocomplete.md).

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

We recommend configuring `cohere.rerank-v3-5:0` as your reranking model, you may also use `amazon.rerank-v1:0`.

```json title="~/.continue/config.json"
{
  "reranker": {
    "name": "bedrock",
    "params": {
      "model": "cohere.rerank-v3-5:0",
      "region": "us-west-2"
    }
  }
}
```

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

---
title: Amazon Bedrock
slug: ../bedrock
---

## 聊天模型

我们推荐配置 **Claude 3.5 Sonnet** 作为你的聊天模型。

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

## 自动补全模型

Bedrock 当前不支持任何自动补全模型。

[点击这里](../../model-types/autocomplete.md) 查看自动补全模型提供者列表。

## 嵌入模型

我们推荐配置 [`amazon.titan-embed-text-v2:0`](https://docs.aws.amazon.com/bedrock/latest/devguide/models.html#amazon.titan-embed-text-v2-0) 作为你的嵌入模型。

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

## 重排序模型

Bedrock 当前没有任何重排序模型。

[点击这里](../../model-types/reranking.md) 查看重排序模型提供者列表。

## 认证

认证可以通过 `~/.aws/credentials` 配置属性中临时的或长期的证书，(例如 "bedrock") 。

```title="~/.aws/credentials
[bedrock]
aws_access_key_id = abcdefg
aws_secret_access_key = hijklmno
aws_session_token = pqrstuvwxyz # Optional: means short term creds.
```

## 定制导入模型

为了设置 Bedrock 使用定制导入模型，将下面的配置添加到你的 `config.json` 文件中：

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

认证可以通过 `~/.aws/credentials` 配置属性中临时的或长期的证书，(例如 "bedrock") 。

```title="~/.aws/credentials
[bedrock]
aws_access_key_id = abcdefg
aws_secret_access_key = hijklmno
aws_session_token = pqrstuvwxyz # Optional: means short term creds.
```

---
title: 配置迁移到 YAML
description: 从 JSON 迁移到 YAML Continue 配置参考
keywords: [配置, yaml, 定制, 迁移]
---

# 迁移配置到 YAML

Continue 的 YAML 配置格式提供更可读、可管理、一致的配置文件，也有一些新的配置选项和移除一些旧的配置选项。 YAML 是更推荐的格式，将会用来与将来的 Continue 产品集成。以下是一个简单的指南，从 `config.json` 迁移到 `config.yaml` 。

同时查看

- [YAML 介绍](https://yaml.org/)
- [JSON Continue 配置参考](/json-reference)
- [YAML Continue 配置参考](/reference)

## 创建 YAML 文件

创建一个 `config.yaml` 文件在你的 Continue 全局文件夹 (`~/.continue` 在 Mac 上，`%USERPROFILE%\.continue`) ，在你当前的 `config.json` 文件旁边。如果 `config.yaml` 文件存在，它将被加载替代 `config.json` 。

给你的配置一个 `name` 和一个 `version` ：

```yaml title="config.yaml"
name: my-configuration
version: 0.0.1
```

### 模型

添加在 `config.json` 中的所有模型配置，包括在 `models`, `tabAutocompleteModel`, `embeddingsProvider` 和 `reranker` 中的模型，到你的新的 YAML 配置文件中的 `models` 小节。一个新的 `roles` YAML 字段指定一个模型可以用来哪个角色，可能的值是 `chat`, `autocomplete`, `embed`, `rerank`, `edit`, `apply`, `summarize` 。

- 在配置中的 `models` 应该有 `roles: [chat]`
- 在配置中的 `tabAutocompleteModel`(s) 应该有 `roles: [autocomplete]`
- 在配置中的 `embeddingsProvider` 应该有 `roles: [embed]`
- 在配置中的 `reranker` 应该有 `roles: [rerank]`
- `experimental.modelRoles` 被替代，只需要简单的添加角色到模型中
  - `inlineEdit` -> 例如 `roles: [chat, edit]`
  - `applyCodeBlock` -> 例如 `roles: [chat, apply]`

模型级别的 `requestOptions` 保留，有微小的修改。查看 [YAML Continue 配置参考](/reference#requestoptions)

模型级别的 `completionOptions` 被 `defaultCompletionOptions` 替代，有微小的修改。查看 [YAML Continue 配置参考](/reference#completionoptions)

<!-- TODO - API KEY -> apiKeySecret? -->
<!-- TODO - ollama autodetect supported? -->

**之前**

```json title="config.json"
{
  "models": [
    {
      "title": "GPT-4",
      "provider": "openai",
      "model": "gpt-4",
      "apiKey": "YOUR_API_KEY",
      "completionOptions": {
        "temperature": 0.5,
        "maxTokens": 2000
      }
    },
    {
      "title": "Ollama",
      "provider": "ollama",
      "model": "AUTODETECT"
    },
    {
      "title": "My Open AI Compatible Model",
      "provider": "openai",
      "apiBase": "http://3.3.3.3/v1",
      "model": "my-openai-compatible-model",
      "requestOptions": {
        "headers": { "X-Auth-Token": "<API_KEY>" }
      }
    }
  ],
  "tabAutocompleteModel": {
    "title": "My Starcoder",
    "provider": "ollama",
    "model": "starcoder2:3b"
  },
  "embeddingsProvider": {
    "provider": "openai",
    "model": "text-embedding-ada-002",
    "apiKey": "<API_KEY>",
    "maxChunkSize": 256,
    "maxBatchSize": 5
  },
  "reranker": {
    "name": "voyage",
    "params": {
      "model": "rerank-2",
      "apiKey": "<VOYAGE_API_KEY>"
    }
  }
}
```

**之后**

```yaml title="config.yaml"
models:
  - name: GPT-4
    provider: openai
    model: gpt-4
    apiKey: <API_KEY>
    defaultCompletionOptions:
      temperature: 0.5
      maxTokens: 2000
    roles:
      - chat
      - edit

  - name: My Voyage Reranker
    provider: voyage
    apiKey: <API_KEY>
    roles:
      - rerank

  - name: My Starcoder
    provider: ollama
    model: starcoder2:3b
    roles:
      - autocomplete

  - name: My Ada Embedder
    provider: openai
    apiKey: <API_KEY>
    roles:
      - embed

  - name: Ollama Autodetect
    provider: ollama
    model: AUTODETECT

  - name: My Open AI Compatible Model - Apply
    provider: openai
    model: my-openai-compatible-model
    apiBase: http://3.3.3.3/v1
    requestOptions:
      headers:
        X-Auth-Token: <API_KEY>
    roles:
      - chat
      - apply
```

注意， `repoMapFileSelection` 试验性模型角色已经废弃。

### 上下文提供者

JSON `contextProviders` 字段被 YAML `context` 列表替代。

- JSON `name` 映射为 `provider`
- JSON `params` 映射为 `params`

**之前**

```json title="config.json"
{
  "contextProviders": [
    {
      "name": "docs"
    },
    {
      "name": "codebase",
      "params": {
        "nRetrieve": 30,
        "nFinal": 3
      }
    },
    {
      "name": "diff",
      "params": {}
    }
  ]
}
```

**之后**

```yaml title="config.yaml"
context:
  - provider: docs

  - provider: codebase
    params:
      nRetrieve: 30
      nFinal: 3

  - params: diff
```

### 系统消息

`systemMessage` 属性被 `rules` 属性替代，采用字符串列表。

**之前**

```json title="config.json"
{
  "systemMessage": "Always give concise responses"
}
```

**之后**

```yaml title="config.yaml"
rules:
  - Always give concise responses
```

### 提示词

不是 `customCommands` ，现在你可以使用 `prompts` 字段定义定制提示词。

**之前**

```json title="config.json"
{
  "customCommands": [
    {
      "name": "check",
      "description": "Check for mistakes in my code",
      "prompt": "{{{ input }}}\n\nPlease read the highlighted code and check for any mistakes. You should look for the following, and be extremely vigilant:\n- Syntax errors\n- Logic errors\n- Security vulnerabilities\n- Performance issues\n- Anything else that looks wrong\n\nOnce you find an error, please explain it as clearly as possible, but without using extra words. For example, instead of saying 'I think there is a syntax error on line 5', you should say 'Syntax error on line 5'. Give your answer as one bullet point per mistake found."
    }
  ]
}
```

**之后**

```yaml title="config.yaml"
prompts:
  - name: check
    description: Check for mistakes in my code
    prompt: |
      Please read the highlighted code and check for any mistakes. You should look for the following, and be extremely vigilant:
        - Syntax errors
        - Logic errors
        - Security vulnerabilities
        - Performance issues
        - Anything else that looks wrong

      Once you find an error, please explain it as clearly as possible, but without using extra words. For example, instead of saying 'I think there is a syntax error on line 5', you should say 'Syntax error on line 5'. Give your answer as one bullet point per mistake found.
```

### 文档

文档大部分是一样的，但是 `title` 属性被 `name` 替代。 `startUrl`, `rootUrl` 和 `faviconUrl` 。

**之前**

```json title="config.json"
{
  "docs": [
    {
      "startUrl": "https://docs.nestjs.com/",
      "title": "nest.js"
    },
    {
      "startUrl": "https://mysite.com/docs/",
      "title": "My site"
    }
  ]
}
```

**之后**

```yaml title="config.yaml"
docs:
  - name: nest.js
    startUrl: https://docs.nestjs.com/

  - name: My site
    startUrl: https://mysite.com/docs/
```

### MCP 服务器

<!-- TODO this is definitely wrong -->

**属性：**

- `name` (**必需的**): MCP 服务器的名称。
- `command` (**必需的**): 启动服务器的命令。
- `args`: 一个可选的命令的参数列表。
- `env`: 一个可选的服务器进程的环境变量映射。

**之前**

```json title="config.json"
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "uvx",
          "args": ["mcp-server-sqlite", "--db-path", "/Users/NAME/test.db"],
          "env": {
            "KEY": "<VALUE>"
          }
        }
      }
    ]
  }
}
```

**之后**

```yaml title="config.yaml"
mcpServers:
  - name: My MCP Server
    command: uvx
    args:
      - mcp-server-sqlite
      - --db-path
      - /Users/NAME/test.db
    env:
      KEY: <VALUE>
```

---

## 废弃的配置选项

一些废弃的 `config.json` 设置不再保存在配置中，移动到 [用户设置页面](./customize/settings.md) 编辑（齿轮图标）。如果在 `config.json` 发现，它们会迁移到 [用户设置页面](./customize/settings.md) ，并从 `config.json` 中移除。

查看 [JSON 配置参考](./reference#完全弃用的设置) 获取更多完全启用配置的信息。

以下在 `config.json` 中最高级别的字段在使用 `config.json` 时仍然可用，但是已经废弃，并且不在 YAML 有等效的字段：

- 斜杠命令 (JSON `slashCommands`)
- 最高级别 `requestOptions`
- 最高级别 `completionOptions`
- `tabAutocompleteOptions`
  - `disable`
  - `maxPromptTokens`
  - `debounceDelay`
  - `maxSuffixPercentage`
  - `prefixPercentage`
  - `template`
  - `onlyMyCode`
- `analytics`
- `customCommands`
- `experimental`
- `userToken`

## 新的配置选项

YAML 配置格式提供不在 JSON 格式中的新的配置选项。查看 [YAML 配置参考](/yaml-reference) 获取更多信息。
